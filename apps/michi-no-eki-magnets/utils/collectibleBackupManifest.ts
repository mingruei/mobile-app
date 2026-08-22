import { strFromU8 } from 'fflate';

import { isCollectibleKind, type CollectibleKind } from '../types/stationCollectible';
import {
  COLLECTIBLE_BACKUP_MANIFEST_NAME,
  COLLECTIBLE_BACKUP_PROGRESS_NAME,
  COLLECTIBLE_BACKUP_VERSION,
  COLLECTIBLE_BACKUP_ZIP_PREFIX,
  type CollectibleBackupEntry,
  type CollectibleBackupManifest,
} from '../types/collectibleBackup';
import { getCollectibleZipPath } from './stationCollectibleStorage';

export function normalizeZipEntryPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

export function normalizeExtractedArchive(
  extracted: Record<string, Uint8Array>,
): Record<string, Uint8Array> {
  const normalized: Record<string, Uint8Array> = {};

  for (const [key, value] of Object.entries(extracted)) {
    normalized[normalizeZipEntryPath(key)] = value;
  }

  return normalized;
}

export function findManifestBytes(
  extracted: Record<string, Uint8Array>,
): Uint8Array | undefined {
  const direct = extracted[COLLECTIBLE_BACKUP_MANIFEST_NAME];
  if (direct && direct.length > 0) {
    return direct;
  }

  const match = Object.entries(extracted).find(([key, value]) => {
    return normalizeZipEntryPath(key).endsWith(COLLECTIBLE_BACKUP_MANIFEST_NAME) && value.length > 0;
  });

  return match?.[1];
}

export function isZipArchive(bytes: Uint8Array): boolean {
  if (bytes.length < 4) {
    return false;
  }

  const signature = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const localHeader = bytes[2] === 0x03 && bytes[3] === 0x04;
  const emptyArchive = bytes[2] === 0x05 && bytes[3] === 0x06;
  const spannedArchive = bytes[2] === 0x07 && bytes[3] === 0x08;

  return signature && (localHeader || emptyArchive || spannedArchive);
}

export function buildManifestFromArchive(
  extracted: Record<string, Uint8Array>,
): CollectibleBackupManifest | null {
  const collectibles: CollectibleBackupEntry[] = [];

  for (const [path, bytes] of Object.entries(extracted)) {
    if (bytes.length === 0) {
      continue;
    }

    const normalizedPath = normalizeZipEntryPath(path);
    if (
      normalizedPath === COLLECTIBLE_BACKUP_MANIFEST_NAME ||
      normalizedPath.endsWith(`/${COLLECTIBLE_BACKUP_MANIFEST_NAME}`)
    ) {
      continue;
    }

    const parsed = parseCollectibleZipPath(normalizedPath);
    if (!parsed) {
      continue;
    }

    collectibles.push({
      stationId: parsed.stationId,
      kind: parsed.kind,
      filename: parsed.filename,
      mimeType: null,
      createdAt: Date.now(),
      zipPath: getCollectibleZipPath(parsed.stationId, parsed.kind, parsed.filename),
    });
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

export function resolveImportManifest(
  extracted: Record<string, Uint8Array>,
  options: { allowEmptyCollectibles?: boolean } = {},
): CollectibleBackupManifest {
  const manifestBytes = findManifestBytes(extracted);
  if (manifestBytes) {
    try {
      return validateManifest(parseManifestBytes(manifestBytes), options);
    } catch {
      // Fall back to scanning archive paths.
    }
  }

  const rebuilt = buildManifestFromArchive(extracted);
  if (rebuilt) {
    return rebuilt;
  }

  if (options.allowEmptyCollectibles && extracted[COLLECTIBLE_BACKUP_PROGRESS_NAME]) {
    return {
      version: COLLECTIBLE_BACKUP_VERSION,
      exportedAt: Date.now(),
      collectibles: [],
    };
  }

  throw new Error('collectible-backup-invalid-manifest');
}

export function parseManifestBytes(bytes: Uint8Array): unknown {
  let text = strFromU8(bytes);
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('collectible-backup-invalid-manifest');
  }
}

export function parseCollectibleZipPath(
  zipPath: string,
): { stationId: number; kind: CollectibleKind; filename: string } | null {
  const normalized = normalizeZipEntryPath(zipPath);
  const match = normalized.match(
    new RegExp(`^${COLLECTIBLE_BACKUP_ZIP_PREFIX}/(\\d+)/(magnet|magnet|magnet)/([^/]+)$`),
  );

  if (!match) {
    return null;
  }

  const stationId = Number(match[1]);
  const kind = match[2] as CollectibleKind;
  const filename = match[3];

  if (!Number.isFinite(stationId) || stationId <= 0 || !filename) {
    return null;
  }

  return { stationId, kind, filename };
}

export function parseManifestEntry(
  entry: Record<string, unknown>,
): { stationId: number; kind: CollectibleKind; filename: string } | null {
  const fromZipPath = parseCollectibleZipPath(typeof entry.zipPath === 'string' ? entry.zipPath : '');
  if (fromZipPath) {
    return fromZipPath;
  }

  const stationId = Number(entry.stationId);
  const kind = entry.kind;
  const filename = entry.filename;

  if (
    !Number.isFinite(stationId) ||
    stationId <= 0 ||
    typeof kind !== 'string' ||
    !isCollectibleKind(kind) ||
    typeof filename !== 'string' ||
    filename.length === 0
  ) {
    return null;
  }

  return { stationId, kind, filename };
}

export function validateManifest(
  raw: unknown,
  options: { allowEmptyCollectibles?: boolean } = {},
): CollectibleBackupManifest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('collectible-backup-invalid-manifest');
  }

  const manifest = raw as Partial<CollectibleBackupManifest>;
  if (manifest.version !== COLLECTIBLE_BACKUP_VERSION) {
    throw new Error('collectible-backup-unsupported-version');
  }

  if (!Array.isArray(manifest.collectibles)) {
    throw new Error('collectible-backup-invalid-manifest');
  }

  const collectibles: CollectibleBackupEntry[] = [];

  for (const entry of manifest.collectibles) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }

    const parsed = parseManifestEntry(entry as Record<string, unknown>);
    if (!parsed) {
      continue;
    }

    collectibles.push({
      stationId: parsed.stationId,
      kind: parsed.kind,
      filename: parsed.filename,
      mimeType:
        typeof (entry as CollectibleBackupEntry).mimeType === 'string'
          ? (entry as CollectibleBackupEntry).mimeType
          : null,
      createdAt:
        typeof (entry as CollectibleBackupEntry).createdAt === 'number' &&
        Number.isFinite((entry as CollectibleBackupEntry).createdAt)
          ? (entry as CollectibleBackupEntry).createdAt
          : Date.now(),
      zipPath: getCollectibleZipPath(parsed.stationId, parsed.kind, parsed.filename),
    });
  }

  if (collectibles.length === 0 && !options.allowEmptyCollectibles) {
    throw new Error('collectible-backup-empty-archive');
  }

  return {
    version: COLLECTIBLE_BACKUP_VERSION,
    exportedAt:
      typeof manifest.exportedAt === 'number' && Number.isFinite(manifest.exportedAt)
        ? manifest.exportedAt
        : Date.now(),
    collectibles,
  };
}
