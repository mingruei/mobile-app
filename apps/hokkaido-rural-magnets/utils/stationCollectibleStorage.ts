import { Directory, File, Paths } from 'expo-file-system';

import {
  getDisplayImageUri,
  isDirectoryEntry,
  isFileEntry,
  fileHasContent,
  fileLikelyHasContent,
  writeSourceToNewFile,
} from './collectibleFileIO';
import { normalizeFileUri } from './normalizeFileUri';
import {
  isCollectibleKind,
  COLLECTIBLE_KINDS,
  type StationCollectible,
  type CollectibleKind,
} from '../types/stationCollectible';

const ROOT_DIR_NAME = 'station-collectibles';

const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

function extensionFromMimeType(mimeType?: string | null): string | null {
  if (!mimeType) {
    return null;
  }

  const normalized = mimeType.trim().toLowerCase();
  return MIME_EXTENSION[normalized] ?? null;
}

function extensionFromUri(uri: string): string | null {
  const cleanUri = uri.split('?')[0] ?? uri;
  const match = cleanUri.match(/(\.[a-z0-9]{2,5})$/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function ensureDirectory(path: Directory): Directory {
  if (!path.exists) {
    path.create({ idempotent: true });
  }
  return path;
}

export function getCollectibleRootDirectory(): Directory {
  return ensureDirectory(new Directory(Paths.document, ROOT_DIR_NAME));
}

export function getStationCollectibleDirectory(
  stationId: number,
  kind: CollectibleKind,
): Directory {
  const root = getCollectibleRootDirectory();
  const castleDir = ensureDirectory(new Directory(root, String(stationId)));
  return ensureDirectory(new Directory(castleDir, kind));
}

function isCollectibleFile(entry: Directory | File): entry is File {
  return isFileEntry(entry);
}

function getStoredFileByteLength(file: File): number {
  const reportedSize = file.info().size ?? 0;
  if (reportedSize > 0) {
    return reportedSize;
  }

  try {
    return file.bytesSync().length;
  } catch {
    return 0;
  }
}

function getFileCreatedAt(file: File): number {
  const timestampMatch = file.name.match(/-(\d{10,})/);
  if (timestampMatch) {
    return Number(timestampMatch[1]);
  }

  try {
    const info = file.info();
    if (info.modificationTime != null && info.modificationTime > 0) {
      return info.modificationTime;
    }
  } catch {
    // Fall back to current time when metadata is unavailable.
  }

  return Date.now();
}

function parseCollectibleFile(
  stationId: number,
  kind: CollectibleKind,
  file: File,
): StationCollectible | null {
  if (!file.exists) {
    return null;
  }

  if (!fileLikelyHasContent(file) && getStoredFileByteLength(file) <= 0) {
    return null;
  }

  const createdAt = getFileCreatedAt(file);

  return {
    id: file.name,
    stationId,
    kind,
    uri: getDisplayImageUri(file.uri),
    filename: file.name,
    mimeType: file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
    createdAt,
  };
}

export function getCollectibleZipPath(
  stationId: number,
  kind: CollectibleKind,
  filename: string,
): string {
  return `station-collectibles/${stationId}/${kind}/${filename}`;
}

export function listAllCollectibles(): StationCollectible[] {
  const root = getCollectibleRootDirectory();
  if (!root.exists) {
    return [];
  }

  const results: StationCollectible[] = [];

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
        if (!isCollectibleFile(fileEntry)) {
          continue;
        }

        const item = parseCollectibleFile(stationId, kind, fileEntry);
        if (item) {
          results.push(item);
        }
      }
    }
  }

  return results.sort((left, right) => right.createdAt - left.createdAt);
}

export function listCollectiblesForCastleIds(
  stationIds: readonly number[],
): StationCollectible[] {
  const uniqueIds = [...new Set(stationIds)];
  const results: StationCollectible[] = [];

  for (const stationId of uniqueIds) {
    for (const kind of COLLECTIBLE_KINDS) {
      results.push(...listStationCollectibles(stationId, kind));
    }
  }

  return results;
}

export function listStationCollectibles(
  stationId: number,
  kind: CollectibleKind,
): StationCollectible[] {
  const directory = getStationCollectibleDirectory(stationId, kind);
  if (!directory.exists) {
    return [];
  }

  return directory
    .list()
    .filter(isCollectibleFile)
    .map((file) => parseCollectibleFile(stationId, kind, file))
    .filter((item): item is StationCollectible => item != null)
    .sort((left, right) => right.createdAt - left.createdAt);
}

export function clearStationCollectibleDirectory(
  stationId: number,
  kind: CollectibleKind,
): void {
  const directory = getStationCollectibleDirectory(stationId, kind);
  if (!directory.exists) {
    return;
  }

  for (const entry of directory.list()) {
    if (isCollectibleFile(entry)) {
      try {
        entry.delete();
      } catch {
        // Continue clearing remaining files.
      }
    }
  }
}

export async function saveStationCollectibleFromUri(
  stationId: number,
  kind: CollectibleKind,
  sourceUri: string,
  mimeType?: string | null,
  options?: { base64Data?: string | null },
): Promise<StationCollectible> {
  const directory = getStationCollectibleDirectory(stationId, kind);
  const extension =
    extensionFromMimeType(mimeType) ?? extensionFromUri(sourceUri) ?? '.jpg';

  const filename = `${kind}-${Date.now()}${extension}`;
  const destination = await writeSourceToNewFile(
    sourceUri,
    directory,
    filename,
    { base64Data: options?.base64Data },
  );

  const collectible = parseCollectibleFile(stationId, kind, destination);
  if (!collectible || !(await fileHasContent(destination))) {
    if (destination.exists) {
      destination.delete();
    }
    throw new Error('Failed to save collectible');
  }

  return collectible;
}

export function getCollectibleDisplayUri(item: StationCollectible): string {
  return getDisplayImageUri(item.uri);
}

export function deleteStationCollectible(item: StationCollectible): void {
  const file = new File(normalizeFileUri(item.uri));
  if (file.exists) {
    file.delete();
  }
}

export function isImageCollectible(item: StationCollectible): boolean {
  return item.mimeType?.startsWith('image/') ?? !item.filename.endsWith('.pdf');
}
