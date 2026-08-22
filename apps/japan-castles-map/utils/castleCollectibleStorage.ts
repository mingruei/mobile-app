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
  isSingleFileCollectibleKind,
  COLLECTIBLE_KINDS,
  type CastleCollectible,
  type CollectibleKind,
} from '../types/castleCollectible';

const ROOT_DIR_NAME = 'castle-collectibles';

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

function getCollectibleRootDirectoryReadOnly(): Directory {
  return new Directory(Paths.document, ROOT_DIR_NAME);
}

export function getCollectibleRootDirectory(): Directory {
  return ensureDirectory(getCollectibleRootDirectoryReadOnly());
}

export function getCastleCollectibleDirectory(
  castleId: number,
  kind: CollectibleKind,
): Directory {
  const root = getCollectibleRootDirectory();
  const castleDir = ensureDirectory(new Directory(root, String(castleId)));
  return ensureDirectory(new Directory(castleDir, kind));
}

function resolveCastleCollectibleDirectory(
  castleId: number,
  kind: CollectibleKind,
): Directory | null {
  const root = getCollectibleRootDirectoryReadOnly();
  if (!root.exists) {
    return null;
  }

  const castleDir = new Directory(root, String(castleId));
  if (!castleDir.exists) {
    return null;
  }

  const directory = new Directory(castleDir, kind);
  return directory.exists ? directory : null;
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
  castleId: number,
  kind: CollectibleKind,
  file: File,
): CastleCollectible | null {
  if (!file.exists) {
    return null;
  }

  if (!fileLikelyHasContent(file) && getStoredFileByteLength(file) <= 0) {
    return null;
  }

  const createdAt = getFileCreatedAt(file);

  return {
    id: file.name,
    castleId,
    kind,
    uri: getDisplayImageUri(file.uri),
    filename: file.name,
    mimeType: file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
    createdAt,
  };
}

export function getCollectibleZipPath(
  castleId: number,
  kind: CollectibleKind,
  filename: string,
): string {
  return `castle-collectibles/${castleId}/${kind}/${filename}`;
}

export function listAllCollectibles(): CastleCollectible[] {
  const root = getCollectibleRootDirectoryReadOnly();
  if (!root.exists) {
    return [];
  }

  const results: CastleCollectible[] = [];

  for (const castleEntry of root.list()) {
    if (!isDirectoryEntry(castleEntry)) {
      continue;
    }

    const castleId = Number(castleEntry.name);
    if (!Number.isFinite(castleId) || castleId <= 0) {
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

        const item = parseCollectibleFile(castleId, kind, fileEntry);
        if (item) {
          results.push(item);
        }
      }
    }
  }

  return results.sort((left, right) => right.createdAt - left.createdAt);
}

export function listCollectiblesForCastleIds(
  castleIds: readonly number[],
): CastleCollectible[] {
  const uniqueIds = [...new Set(castleIds)];
  const results: CastleCollectible[] = [];

  for (const castleId of uniqueIds) {
    for (const kind of COLLECTIBLE_KINDS) {
      results.push(...listCastleCollectibles(castleId, kind));
    }
  }

  return results;
}

export function listCastleCollectibles(
  castleId: number,
  kind: CollectibleKind,
): CastleCollectible[] {
  const directory = resolveCastleCollectibleDirectory(castleId, kind);
  if (!directory) {
    return [];
  }

  try {
    return directory
      .list()
      .filter(isCollectibleFile)
      .map((file) => parseCollectibleFile(castleId, kind, file))
      .filter((item): item is CastleCollectible => item != null)
      .sort((left, right) => right.createdAt - left.createdAt);
  } catch {
    return [];
  }
}

export function clearCastleCollectibleDirectory(
  castleId: number,
  kind: CollectibleKind,
): void {
  const directory = resolveCastleCollectibleDirectory(castleId, kind);
  if (!directory) {
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

export async function saveCastleCollectibleFromUri(
  castleId: number,
  kind: CollectibleKind,
  sourceUri: string,
  mimeType?: string | null,
  options?: { base64Data?: string | null },
): Promise<CastleCollectible> {
  const directory = getCastleCollectibleDirectory(castleId, kind);
  const extension =
    extensionFromMimeType(mimeType) ?? extensionFromUri(sourceUri) ?? '.jpg';

  if (isSingleFileCollectibleKind(kind)) {
    clearCastleCollectibleDirectory(castleId, kind);
  }

  const filename = isSingleFileCollectibleKind(kind)
    ? `meijo-stamp-${Date.now()}${extension}`
    : `${kind}-${Date.now()}${extension}`;
  const destination = await writeSourceToNewFile(
    sourceUri,
    directory,
    filename,
    { base64Data: options?.base64Data },
  );

  const collectible = parseCollectibleFile(castleId, kind, destination);
  if (!collectible || !(await fileHasContent(destination))) {
    if (destination.exists) {
      destination.delete();
    }
    throw new Error('Failed to save collectible');
  }

  return collectible;
}

export function getCollectibleDisplayUri(item: CastleCollectible): string {
  const base = getDisplayImageUri(item.uri);
  if (!isSingleFileCollectibleKind(item.kind)) {
    return base;
  }

  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}v=${item.createdAt}`;
}

export function deleteCastleCollectible(item: CastleCollectible): void {
  const file = new File(normalizeFileUri(item.uri));
  if (file.exists) {
    file.delete();
  }
}

export function isImageCollectible(item: CastleCollectible): boolean {
  return item.mimeType?.startsWith('image/') ?? !item.filename.endsWith('.pdf');
}
