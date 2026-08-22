import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { getInfoAsync } from 'expo-file-system/legacy';
import { strToU8, zipSync } from 'fflate';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { unzip as unzipNativeArchive } from 'react-native-zip-archive';

import {
  COLLECTIBLE_BACKUP_GROUPS_NAME,
  COLLECTIBLE_BACKUP_MANIFEST_NAME,
  COLLECTIBLE_BACKUP_PROGRESS_NAME,
  COLLECTIBLE_BACKUP_VERSION,
  COLLECTIBLE_BACKUP_ZIP_PREFIX,
  type CollectibleBackupEntry,
  type CollectibleBackupManifest,
  type CollectibleImportMode,
  type CollectibleImportResult,
} from '../types/collectibleBackup';
import { COLLECTIBLE_PROGRESS_FIELD } from '../types/stationCollectible';
import type { StationGroup } from '../types/stationGroup';
import {
  STATION_PROGRESS_FIELDS,
  EMPTY_STATION_PROGRESS_ENTRY,
  withFieldUpdate,
  type StationProgressField,
  type StationProgressMap,
} from '../types/stationProgress';
import {
  getStationCollectibleDirectory,
  clearStationCollectibleDirectory,
  getCollectibleZipPath,
  listAllCollectibles,
} from './stationCollectibleStorage';
import {
  copySourceUriToFile,
  fileHasContent,
  fileLikelyHasContent,
  isDirectoryEntry,
  isFileEntry,
  readSourceBytes,
} from './collectibleFileIO';
import { loadProgressMap, saveProgressMap } from './stationProgressStorage';
import {
  loadStationGroups,
  normalizeStationGroups,
  saveStationGroups,
} from './stationGroupStorage';
import {
  normalizeZipEntryPath,
  validateManifest,
} from './collectibleBackupManifest';
import { mergeProgressMaps, mergeProgressMapsPatch, normalizeProgressMap, serializeProgressMap } from './mergeProgressMap';
import { normalizeFileUri } from './normalizeFileUri';
import { waitForNativePicker } from './waitForNativePicker';
import {
  isCollectibleKind,
  type CollectibleKind,
} from '../types/stationCollectible';

const ZIP_MIME_TYPE = 'application/zip';

const ZIP_PICKER_TYPES =
  Platform.OS === 'ios'
    ? (['public.zip-archive', 'com.pkzip-archive', 'application/zip'] as const)
    : (['application/zip', 'application/x-zip-compressed', '*/*'] as const);

function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, Platform.OS === 'android' ? 16 : 0);
  });
}

function hasExportableProgress(progressMap: StationProgressMap): boolean {
  return Object.values(progressMap).some((entry) =>
    STATION_PROGRESS_FIELDS.some((field) => entry[field]),
  );
}

function countProgressCastles(progressMap: StationProgressMap): number {
  return Object.keys(progressMap).length;
}

function countChangedProgressCastles(before: StationProgressMap, after: StationProgressMap): number {
  const ids = new Set([...Object.keys(before), ...Object.keys(after)].map(Number));
  let changed = 0;

  for (const stationId of ids) {
    const previous = before[stationId] ?? EMPTY_STATION_PROGRESS_ENTRY;
    const next = after[stationId] ?? EMPTY_STATION_PROGRESS_ENTRY;

    if (
      STATION_PROGRESS_FIELDS.some(
        (field) =>
          previous[field] !== next[field] || previous.updatedAt[field] !== next.updatedAt[field],
      )
    ) {
      changed += 1;
    }
  }

  return changed;
}

function stationGroupsEqual(left: StationGroup, right: StationGroup): boolean {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.createdAt === right.createdAt &&
    left.updatedAt === right.updatedAt &&
    left.stationIds.length === right.stationIds.length &&
    left.stationIds.every((stationId, index) => stationId === right.stationIds[index])
  );
}

function countChangedStationGroups(before: readonly StationGroup[], after: readonly StationGroup[]): number {
  const beforeById = new Map(before.map((group) => [group.id, group]));
  const afterById = new Map(after.map((group) => [group.id, group]));
  const ids = new Set([...beforeById.keys(), ...afterById.keys()]);
  let changed = 0;

  for (const id of ids) {
    const previous = beforeById.get(id);
    const next = afterById.get(id);

    if (!previous || !next || !stationGroupsEqual(previous, next)) {
      changed += 1;
    }
  }

  return changed;
}

function mergeStationGroups(
  localGroups: readonly StationGroup[],
  importedGroups: readonly StationGroup[],
  mode: CollectibleImportMode,
): StationGroup[] {
  if (mode === 'replace') {
    return [...importedGroups];
  }

  const mergedById = new Map(localGroups.map((group) => [group.id, group]));

  for (const importedGroup of importedGroups) {
    const existing = mergedById.get(importedGroup.id);
    if (!existing) {
      mergedById.set(importedGroup.id, importedGroup);
      continue;
    }

    if (Date.parse(importedGroup.updatedAt) >= Date.parse(existing.updatedAt)) {
      mergedById.set(importedGroup.id, importedGroup);
    }
  }

  return [...mergedById.values()];
}

async function stageImportArchive(sourceUri: string): Promise<File> {
  const importDir = new Directory(Paths.cache, 'collectible-import');
  if (!importDir.exists) {
    importDir.create({ idempotent: true });
  }

  const cachedZip = new File(importDir, `import-${Date.now()}.zip`);
  if (cachedZip.exists) {
    cachedZip.delete();
  }

  try {
    await copySourceUriToFile(sourceUri, cachedZip);
  } catch {
    throw new Error('collectible-backup-read-failed');
  }

  await yieldToMainThread();

  if (fileLikelyHasContent(cachedZip) || (await fileHasContent(cachedZip))) {
    return cachedZip;
  }

  for (const uri of [normalizeFileUri(cachedZip.uri), cachedZip.uri]) {
    try {
      const info = await getInfoAsync(uri);
      if (info.exists && (info.size ?? 0) > 0) {
        return cachedZip;
      }
    } catch {
      // Try the next URI format.
    }
  }

  throw new Error('collectible-backup-read-failed');
}

function getFilesystemPath(uri: string): string {
  const normalized = normalizeFileUri(uri);
  if (normalized.startsWith('file://')) {
    return decodeURI(normalized.slice('file://'.length));
  }

  return normalized;
}

function getExtractedEntryFile(extractDir: Directory, zipPath: string): File {
  const parts = normalizeZipEntryPath(zipPath).split('/');
  let currentDir = extractDir;

  for (let index = 0; index < parts.length - 1; index += 1) {
    currentDir = new Directory(currentDir, parts[index]);
  }

  return new File(currentDir, parts[parts.length - 1] ?? '');
}

function buildManifestFromExtractedDirectory(
  extractDir: Directory,
): CollectibleBackupManifest | null {
  const root = new Directory(extractDir, COLLECTIBLE_BACKUP_ZIP_PREFIX);
  if (!root.exists) {
    return null;
  }

  const collectibles: CollectibleBackupEntry[] = [];

  for (const castleEntry of root.list()) {
    if (!isDirectoryEntry(castleEntry)) {
      continue;
    }

    const stationId = Number(castleEntry.name);
    if (!Number.isFinite(stationId) || stationId <= 0) {
      continue;
    }

    for (const kindEntry of castleEntry.list()) {
      if (!isDirectoryEntry(kindEntry)) {
        continue;
      }

      const kind = kindEntry.name;
      if (!isCollectibleKind(kind)) {
        continue;
      }

      for (const fileEntry of kindEntry.list()) {
        if (!isFileEntry(fileEntry)) {
          continue;
        }

        collectibles.push({
          stationId,
          kind,
          filename: fileEntry.name,
          mimeType: fileEntry.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
          createdAt: Date.now(),
          zipPath: getCollectibleZipPath(stationId, kind, fileEntry.name),
        });
      }
    }
  }

  if (collectibles.length === 0) {
    return null;
  }

  return {
    version: COLLECTIBLE_BACKUP_VERSION,
    exportedAt: Date.now(),
    collectibles,
  };
}

async function readManifestFromExtractDir(
  extractDir: Directory,
): Promise<CollectibleBackupManifest> {
  const progressFile = new File(extractDir, COLLECTIBLE_BACKUP_PROGRESS_NAME);
  const groupsFile = new File(extractDir, COLLECTIBLE_BACKUP_GROUPS_NAME);
  const allowEmptyCollectibles = progressFile.exists || groupsFile.exists;
  const manifestFile = new File(extractDir, COLLECTIBLE_BACKUP_MANIFEST_NAME);
  if (manifestFile.exists) {
    try {
      let text = await manifestFile.text();
      if (text.charCodeAt(0) === 0xfeff) {
        text = text.slice(1);
      }

      return validateManifest(JSON.parse(text), { allowEmptyCollectibles });
    } catch {
      // Fall back to scanning extracted files.
    }
  }

  const rebuilt = buildManifestFromExtractedDirectory(extractDir);
  if (rebuilt) {
    return rebuilt;
  }

  if (allowEmptyCollectibles) {
    return {
      version: COLLECTIBLE_BACKUP_VERSION,
      exportedAt: Date.now(),
      collectibles: [],
    };
  }

  throw new Error('collectible-backup-invalid-manifest');
}

async function extractArchiveOnDevice(zipFile: File): Promise<Directory> {
  const importRoot = new Directory(Paths.cache, 'collectible-import');
  if (!importRoot.exists) {
    importRoot.create({ idempotent: true });
  }

  const extractDir = new Directory(importRoot, `extracted-${Date.now()}`);
  if (extractDir.exists) {
    extractDir.delete();
  }
  extractDir.create({ idempotent: true });

  try {
    await unzipNativeArchive(getFilesystemPath(zipFile.uri), getFilesystemPath(extractDir.uri));
  } catch {
    throw new Error('collectible-backup-invalid-archive');
  }

  const manifestFile = new File(extractDir, COLLECTIBLE_BACKUP_MANIFEST_NAME);
  const progressFile = new File(extractDir, COLLECTIBLE_BACKUP_PROGRESS_NAME);
  const groupsFile = new File(extractDir, COLLECTIBLE_BACKUP_GROUPS_NAME);
  const collectiblesRoot = new Directory(extractDir, COLLECTIBLE_BACKUP_ZIP_PREFIX);
  if (
    !manifestFile.exists &&
    !collectiblesRoot.exists &&
    !progressFile.exists &&
    !groupsFile.exists
  ) {
    throw new Error('collectible-backup-invalid-archive');
  }

  return extractDir;
}

function cleanupImportArtifacts(stagedZip: File, extractDir: Directory | null): void {
  try {
    if (stagedZip.exists) {
      stagedZip.delete();
    }
  } catch {
    // Best-effort cleanup only.
  }

  if (!extractDir?.exists) {
    return;
  }

  try {
    extractDir.delete();
  } catch {
    // Best-effort cleanup only.
  }
}

async function readImportedProgress(extractDir: Directory): Promise<StationProgressMap | null> {
  const progressFile = new File(extractDir, COLLECTIBLE_BACKUP_PROGRESS_NAME);
  if (!progressFile.exists) {
    return null;
  }

  let text = await progressFile.text();
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  const importedProgress = normalizeProgressMap(JSON.parse(text));
  if (!hasExportableProgress(importedProgress)) {
    return null;
  }

  return importedProgress;
}

async function readImportedGroups(extractDir: Directory): Promise<StationGroup[] | null> {
  const groupsFile = new File(extractDir, COLLECTIBLE_BACKUP_GROUPS_NAME);
  if (!groupsFile.exists) {
    return null;
  }

  let text = await groupsFile.text();
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  const importedGroups = normalizeStationGroups(JSON.parse(text));
  if (importedGroups.length === 0) {
    return null;
  }

  return importedGroups;
}

function applyImportedProgress(
  localProgress: StationProgressMap,
  importedProgress: StationProgressMap,
  mode: CollectibleImportMode,
): StationProgressMap {
  if (mode === 'replace') {
    return mergeProgressMapsPatch(localProgress, importedProgress);
  }

  return mergeProgressMaps(importedProgress, localProgress);
}

async function mergeImportedProgress(
  extractDir: Directory,
  mode: CollectibleImportMode,
): Promise<number> {
  let importedProgress: StationProgressMap;
  try {
    const parsed = await readImportedProgress(extractDir);
    if (!parsed) {
      return 0;
    }

    importedProgress = parsed;
  } catch {
    throw new Error('collectible-backup-invalid-progress');
  }

  const localProgress = await loadProgressMap();
  const mergedProgress = applyImportedProgress(localProgress, importedProgress, mode);
  const changedCastles = countChangedProgressCastles(localProgress, mergedProgress);

  if (changedCastles === 0) {
    return 0;
  }

  await saveProgressMap(mergedProgress);
  return changedCastles;
}

async function mergeImportedGroups(
  extractDir: Directory,
  mode: CollectibleImportMode,
): Promise<number> {
  let importedGroups: StationGroup[];
  try {
    const parsed = await readImportedGroups(extractDir);
    if (!parsed) {
      return 0;
    }

    importedGroups = parsed;
  } catch {
    throw new Error('collectible-backup-invalid-groups');
  }

  const localGroups = await loadStationGroups();
  const mergedGroups = mergeStationGroups(localGroups, importedGroups, mode);
  const changedGroups = countChangedStationGroups(localGroups, mergedGroups);

  if (changedGroups === 0) {
    return 0;
  }

  await saveStationGroups(mergedGroups);
  return changedGroups;
}

async function importCollectiblesFromDirectory(
  extractDir: Directory,
  mode: CollectibleImportMode,
): Promise<CollectibleImportResult> {
  const progressMerged = await mergeImportedProgress(extractDir, mode);
  const groupsMerged = await mergeImportedGroups(extractDir, mode);
  const manifest = await readManifestFromExtractDir(extractDir);
  let imported = 0;
  let skipped = 0;
  const importedKeys = new Set<string>();

  for (const entry of manifest.collectibles) {
    await yieldToMainThread();

    const sourceFile = getExtractedEntryFile(extractDir, entry.zipPath);
    if (!sourceFile.exists) {
      skipped += 1;
      continue;
    }

    const destination = new File(
      getStationCollectibleDirectory(entry.stationId, entry.kind),
      entry.filename,
    );

      if (destination.exists) {
        if (mode === 'merge-newer') {
          skipped += 1;
          continue;
        }

        destination.delete();
      }

    try {
      await copySourceUriToFile(sourceFile.uri, destination);
    } catch {
      skipped += 1;
      continue;
    }

    if (!(await importFileHasContent(destination))) {
      if (destination.exists) {
        destination.delete();
      }
      skipped += 1;
      continue;
    }

    imported += 1;
    importedKeys.add(`${entry.stationId}:${entry.kind}`);
  }

  const hasBackupCollectibles = manifest.collectibles.length > 0;
  let hasBackupProgress = false;
  let hasBackupGroups = false;
  try {
    hasBackupProgress = (await readImportedProgress(extractDir)) !== null;
  } catch {
    throw new Error('collectible-backup-invalid-progress');
  }

  try {
    hasBackupGroups = (await readImportedGroups(extractDir)) !== null;
  } catch {
    throw new Error('collectible-backup-invalid-groups');
  }

  if (imported === 0 && progressMerged === 0 && groupsMerged === 0) {
    if (!hasBackupCollectibles && !hasBackupProgress && !hasBackupGroups) {
      throw new Error('collectible-backup-invalid-manifest');
    }

    if (mode === 'merge-newer') {
      throw new Error('collectible-backup-import-nothing-new');
    }
  }

  const castlesUpdated = await markImportedCollectibles(importedKeys);

  return {
    imported,
    skipped,
    castlesUpdated,
    progressMerged,
    groupsMerged,
  };
}

function buildManifest(collectibles: ReturnType<typeof listAllCollectibles>): CollectibleBackupManifest {
  return {
    version: COLLECTIBLE_BACKUP_VERSION,
    exportedAt: Date.now(),
    collectibles: collectibles.map((item) => ({
      stationId: item.stationId,
      kind: item.kind,
      filename: item.filename,
      mimeType: item.mimeType,
      createdAt: item.createdAt,
      zipPath: getCollectibleZipPath(item.stationId, item.kind, item.filename),
    })),
  };
}

async function writeZipArchive(
  manifest: CollectibleBackupManifest,
  progressMap: StationProgressMap,
  groups: readonly StationGroup[],
): Promise<File> {
  const archiveEntries: Record<string, Uint8Array> = {
    [COLLECTIBLE_BACKUP_MANIFEST_NAME]: strToU8(JSON.stringify(manifest, null, 2)),
  };

  if (hasExportableProgress(progressMap)) {
    archiveEntries[COLLECTIBLE_BACKUP_PROGRESS_NAME] = strToU8(
      JSON.stringify(serializeProgressMap(progressMap), null, 2),
    );
  }

  if (groups.length > 0) {
    archiveEntries[COLLECTIBLE_BACKUP_GROUPS_NAME] = strToU8(JSON.stringify(groups, null, 2));
  }

  for (const entry of manifest.collectibles) {
    await yieldToMainThread();

    const directory = getStationCollectibleDirectory(entry.stationId, entry.kind);
    const source = new File(directory, entry.filename);
    if (!source.exists) {
      continue;
    }

    archiveEntries[entry.zipPath] = await readSourceBytes(source.uri);
  }

  await yieldToMainThread();
  const zipped = zipSync(archiveEntries, { level: 6 });
  const exportDir = new Directory(Paths.cache, 'collectible-export');
  if (!exportDir.exists) {
    exportDir.create({ idempotent: true });
  }

  const zipFile = new File(exportDir, `japan-stations-backup-${Date.now()}.zip`);
  if (zipFile.exists) {
    zipFile.delete();
  }

  zipFile.write(zipped);
  if (!(await fileHasContent(zipFile))) {
    throw new Error('collectible-backup-export-failed');
  }

  return zipFile;
}

async function shareZipFile(zipFile: File): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('collectible-backup-share-unavailable');
  }

  await Sharing.shareAsync(zipFile.uri, {
    mimeType: ZIP_MIME_TYPE,
    UTI: 'com.pkzip-archive',
  });
}

async function pickZipArchive(): Promise<string | null> {
  await waitForNativePicker();

  const result = await DocumentPicker.getDocumentAsync({
    type: [...ZIP_PICKER_TYPES],
    copyToCacheDirectory: Platform.OS !== 'android',
    multiple: false,
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  return result.assets[0]?.uri ?? null;
}

async function markImportedCollectibles(importedKeys: Set<string>): Promise<number> {
  if (importedKeys.size === 0) {
    return 0;
  }

  const progressMap = await loadProgressMap();
  const updatedCastleIds = new Set<number>();

  for (const key of importedKeys) {
    const [stationIdRaw, kindRaw] = key.split(':');
    const stationId = Number(stationIdRaw);
    const kind = kindRaw as CollectibleKind;
    const progressField = COLLECTIBLE_PROGRESS_FIELD[kind] as StationProgressField;

    if (!Number.isFinite(stationId) || stationId <= 0) {
      continue;
    }

    const previous = progressMap[stationId] ?? EMPTY_STATION_PROGRESS_ENTRY;
    if (previous[progressField]) {
      continue;
    }

    progressMap[stationId] = withFieldUpdate(previous, progressField, true);
    updatedCastleIds.add(stationId);
  }

  await saveProgressMap(progressMap);
  return updatedCastleIds.size;
}

async function importFileHasContent(destination: File): Promise<boolean> {
  if (!destination.exists) {
    return false;
  }

  if (fileLikelyHasContent(destination)) {
    return true;
  }

  return fileHasContent(destination);
}

export async function pickCollectibleArchive(): Promise<string | null> {
  return pickZipArchive();
}

export async function processCollectibleImport(
  sourceUri: string,
  mode: CollectibleImportMode = 'merge-newer',
): Promise<CollectibleImportResult> {
  await yieldToMainThread();

  const stagedZip = await stageImportArchive(sourceUri);
  await yieldToMainThread();

  let extractDir: Directory | null = null;
  try {
    extractDir = await extractArchiveOnDevice(stagedZip);
    await yieldToMainThread();
    return await importCollectiblesFromDirectory(extractDir, mode);
  } finally {
    cleanupImportArtifacts(stagedZip, extractDir);
  }
}

export async function exportCollectibleArchive(): Promise<{
  fileCount: number;
  progressStations: number;
  groupCount: number;
}> {
  const collectibles = listAllCollectibles();
  const progressMap = await loadProgressMap();
  const groups = await loadStationGroups();
  const hasCollectibles = collectibles.length > 0;
  const hasProgress = hasExportableProgress(progressMap);
  const hasGroups = groups.length > 0;

  if (!hasCollectibles && !hasProgress && !hasGroups) {
    throw new Error('collectible-backup-nothing-to-export');
  }

  const manifest = buildManifest(collectibles);
  const zipFile = await writeZipArchive(manifest, progressMap, groups);
  await shareZipFile(zipFile);

  return {
    fileCount: manifest.collectibles.length,
    progressStations: hasProgress ? countProgressCastles(progressMap) : 0,
    groupCount: hasGroups ? groups.length : 0,
  };
}

export async function importCollectibleArchive(): Promise<CollectibleImportResult | null> {
  const sourceUri = await pickZipArchive();
  if (!sourceUri) {
    return null;
  }

  return processCollectibleImport(sourceUri);
}
