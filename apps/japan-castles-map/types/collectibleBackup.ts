import type { CollectibleKind } from './castleCollectible';

export const COLLECTIBLE_BACKUP_VERSION = 1;
export const COLLECTIBLE_BACKUP_MANIFEST_NAME = 'manifest.json';
export const COLLECTIBLE_BACKUP_PROGRESS_NAME = 'progress.json';
export const COLLECTIBLE_BACKUP_GROUPS_NAME = 'groups.json';
export const COLLECTIBLE_BACKUP_ZIP_PREFIX = 'castle-collectibles';

export type CollectibleBackupEntry = {
  castleId: number;
  kind: CollectibleKind;
  filename: string;
  mimeType: string | null;
  createdAt: number;
  zipPath: string;
};

export type CollectibleBackupManifest = {
  version: typeof COLLECTIBLE_BACKUP_VERSION;
  exportedAt: number;
  collectibles: CollectibleBackupEntry[];
};

export type CollectibleImportMode = 'replace' | 'merge-newer';

export type CollectibleImportResult = {
  imported: number;
  skipped: number;
  castlesUpdated: number;
  progressMerged: number;
  groupsMerged: number;
};
