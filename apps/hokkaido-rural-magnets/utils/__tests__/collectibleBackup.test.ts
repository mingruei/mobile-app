jest.mock('../waitForNativePicker', () => ({
  waitForNativePicker: jest.fn(async () => undefined),
}));

jest.mock('../stationCollectibleStorage', () => ({
  listAllCollectibles: jest.fn(() => []),
  getCollectibleZipPath: jest.fn(
    (stationId: number, kind: string, filename: string) =>
      `station-collectibles/${stationId}/${kind}/${filename}`,
  ),
  getStationCollectibleDirectory: jest.fn(() => ({
    exists: false,
    list: jest.fn(() => []),
  })),
  clearStationCollectibleDirectory: jest.fn(),
}));

jest.mock('../stationProgressStorage', () => ({
  loadProgressMap: jest.fn(async () => ({})),
  saveProgressMap: jest.fn(async () => undefined),
}));

jest.mock('../stationGroupStorage', () => ({
  loadStationGroups: jest.fn(async () => []),
  saveStationGroups: jest.fn(async () => undefined),
  normalizeStationGroups: jest.fn((raw: unknown) => {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw.filter((value) => {
      if (!value || typeof value !== 'object') {
        return false;
      }

      const candidate = value as {
        id?: unknown;
        name?: unknown;
        stationIds?: unknown;
        createdAt?: unknown;
        updatedAt?: unknown;
      };

      return (
        typeof candidate.id === 'string' &&
        typeof candidate.name === 'string' &&
        Array.isArray(candidate.stationIds) &&
        candidate.stationIds.every((id) => typeof id === 'number') &&
        typeof candidate.createdAt === 'string' &&
        typeof candidate.updatedAt === 'string'
      );
    });
  }),
}));

jest.mock('../collectibleFileIO', () => ({
  copySourceUriToFile: jest.fn(async (_source: string, destination: { write: (bytes: Uint8Array) => void }) => {
    destination.write(new Uint8Array([1, 2, 3]));
  }),
  fileHasContent: jest.fn(async () => true),
  fileLikelyHasContent: jest.fn(() => true),
  readSourceBytes: jest.fn(async () => new Uint8Array([1])),
  isDirectoryEntry: jest.fn((entry: { extension?: string }) => !('extension' in entry)),
  isFileEntry: jest.fn((entry: { extension?: string }) => 'extension' in entry),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(async () => ({ exists: true, size: 128 })),
}));

jest.mock('react-native-zip-archive', () => ({
  unzip: jest.fn(async () => undefined),
}));

jest.mock('expo-file-system', () => {
  const mockFileRegistry = new Map<string, Uint8Array>();

  function entryKey(parentUri: string, name: string): string {
    const base = parentUri.endsWith('/') ? parentUri.slice(0, -1) : parentUri;
    return `${base}/${name}`;
  }

  class MockFile {
    uri: string;
    name: string;
    parentUri: string;

    constructor(parent: { uri?: string } | string, name: string) {
      if (typeof parent === 'string') {
        this.parentUri = parent.startsWith('file://') ? parent : `file:///mock/${parent}`;
      } else {
        this.parentUri = parent.uri ?? 'file:///mock';
      }
      this.name = name;
      this.uri = entryKey(this.parentUri, name);
    }

    get exists(): boolean {
      return mockFileRegistry.has(this.uri);
    }

    create = jest.fn(() => {
      mockFileRegistry.set(this.uri, new Uint8Array());
    });

    delete = jest.fn(() => {
      mockFileRegistry.delete(this.uri);
    });

    write = jest.fn((bytes: Uint8Array) => {
      mockFileRegistry.set(this.uri, bytes);
    });

    text = jest.fn(async () => {
      const bytes = mockFileRegistry.get(this.uri);
      return bytes ? new TextDecoder().decode(bytes) : '{}';
    });

    bytesSync = jest.fn(() => mockFileRegistry.get(this.uri) ?? new Uint8Array([0x50, 0x4b, 0x03, 0x04]));

    info = jest.fn(() => ({ size: mockFileRegistry.get(this.uri)?.length ?? 0 }));
  }

  function listDirectoryEntries(dirUri: string): unknown[] {
    const prefix = `${dirUri}/`;
    const childNames = new Map<string, 'file' | 'dir'>();

    for (const key of mockFileRegistry.keys()) {
      if (!key.startsWith(prefix)) {
        continue;
      }

      const rest = key.slice(prefix.length);
      const [segment, ...remaining] = rest.split('/');
      if (!segment) {
        continue;
      }

      childNames.set(segment, remaining.length > 0 ? 'dir' : 'file');
    }

    return [...childNames.entries()].map(([name, type]) => {
      if (type === 'dir') {
        const childUri = entryKey(dirUri, name);
        return {
          name,
          uri: childUri,
          list: () => listDirectoryEntries(childUri),
        };
      }

      return {
        name,
        extension: name.includes('.') ? `.${name.split('.').pop()}` : '',
        uri: entryKey(dirUri, name),
      };
    });
  }

  class MockDirectory {
    uri: string;
    name: string;
    private manualExists = false;

    constructor(parent: { uri?: string } | string, name: string) {
      if (typeof parent === 'string') {
        const base = parent.startsWith('file://') ? parent : `file:///mock/${parent}`;
        this.uri = entryKey(base, name);
      } else {
        this.uri = entryKey(parent.uri ?? 'file:///mock', name);
      }
      this.name = name;
    }

    get exists(): boolean {
      if (this.manualExists) {
        return true;
      }

      for (const key of mockFileRegistry.keys()) {
        if (key === this.uri || key.startsWith(`${this.uri}/`)) {
          return true;
        }
      }

      return false;
    }

    create = jest.fn(function create(this: MockDirectory) {
      this.manualExists = true;
    });

    delete = jest.fn(function del(this: MockDirectory) {
      this.manualExists = false;
      for (const key of [...mockFileRegistry.keys()]) {
        if (key === this.uri || key.startsWith(`${this.uri}/`)) {
          mockFileRegistry.delete(key);
        }
      }
    });

    list = jest.fn(function list(this: MockDirectory) {
      return listDirectoryEntries(this.uri);
    });
  }

  return {
    File: MockFile,
    Directory: MockDirectory,
    Paths: { cache: 'file:///cache', document: 'file:///documents' },
    __mockFileRegistry: mockFileRegistry,
  };
});

const fileSystemMock = jest.requireMock('expo-file-system') as {
  __mockFileRegistry: Map<string, Uint8Array>;
};

import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { Platform } from 'react-native';

import {
  COLLECTIBLE_BACKUP_GROUPS_NAME,
  COLLECTIBLE_BACKUP_MANIFEST_NAME,
  COLLECTIBLE_BACKUP_PROGRESS_NAME,
  COLLECTIBLE_BACKUP_VERSION,
} from '../../types/collectibleBackup';
import type { StationGroup } from '../../types/stationGroup';
import { createProgressEntry } from '../../types/stationProgress';
import { getStationCollectibleDirectory, listAllCollectibles, clearStationCollectibleDirectory } from '../stationCollectibleStorage';
import {
  copySourceUriToFile,
  fileHasContent,
  fileLikelyHasContent,
  readSourceBytes,
} from '../collectibleFileIO';
import { getInfoAsync } from 'expo-file-system/legacy';
import { unzip as nativeUnzip } from 'react-native-zip-archive';
import { loadProgressMap, saveProgressMap } from '../stationProgressStorage';
import { loadStationGroups, saveStationGroups } from '../stationGroupStorage';
import {
  exportCollectibleArchive,
  importCollectibleArchive,
  pickCollectibleArchive,
  processCollectibleImport,
} from '../collectibleBackup';

const mockedListAll = listAllCollectibles as jest.MockedFunction<typeof listAllCollectibles>;
const mockedLoadProgress = loadProgressMap as jest.MockedFunction<typeof loadProgressMap>;
const mockedSaveProgress = saveProgressMap as jest.MockedFunction<typeof saveProgressMap>;
const mockedLoadGroups = loadStationGroups as jest.MockedFunction<typeof loadStationGroups>;
const mockedSaveGroups = saveStationGroups as jest.MockedFunction<typeof saveStationGroups>;
const mockedGetDir = getStationCollectibleDirectory as jest.MockedFunction<typeof getStationCollectibleDirectory>;
const mockedClearDir = clearStationCollectibleDirectory as jest.MockedFunction<
  typeof clearStationCollectibleDirectory
>;
const mockedCopy = copySourceUriToFile as jest.MockedFunction<typeof copySourceUriToFile>;
const mockedFileHasContent = fileHasContent as jest.MockedFunction<typeof fileHasContent>;
const mockedFileLikelyHasContent = fileLikelyHasContent as jest.MockedFunction<typeof fileLikelyHasContent>;
const mockedReadSource = readSourceBytes as jest.MockedFunction<typeof readSourceBytes>;
const mockedGetInfoAsync = getInfoAsync as jest.MockedFunction<typeof getInfoAsync>;
const mockedNativeUnzip = nativeUnzip as jest.MockedFunction<typeof nativeUnzip>;
const mockedGetDocumentAsync = DocumentPicker.getDocumentAsync as jest.MockedFunction<
  typeof DocumentPicker.getDocumentAsync
>;

function buildImportZip(options?: {
  includeProgress?: boolean;
  includeGroups?: boolean;
  groups?: StationGroup[];
  kind?: 'magnet' | 'magnet';
  manifestJson?: string;
  includeCollectibleFile?: boolean;
}): Uint8Array {
  const kind = options?.kind ?? 'magnet';
  const filename = kind === 'magnet' ? 'stamp.jpg' : 'page.jpg';
  const zipPath = `station-collectibles/1/${kind}/${filename}`;
  const manifest = options?.manifestJson ?? JSON.stringify({
    version: COLLECTIBLE_BACKUP_VERSION,
    exportedAt: Date.now(),
    collectibles: [
      {
        stationId: 1,
        kind,
        filename,
        mimeType: 'image/jpeg',
        createdAt: 100,
        zipPath,
      },
    ],
  });

  const entries: Record<string, Uint8Array> = {
    [COLLECTIBLE_BACKUP_MANIFEST_NAME]: strToU8(manifest),
  };

  if (options?.includeCollectibleFile !== false) {
    entries[zipPath] = strToU8('image-data');
  }

  if (options?.includeProgress !== false) {
    entries[COLLECTIBLE_BACKUP_PROGRESS_NAME] = strToU8(
      JSON.stringify({ 1: createProgressEntry({ visited: true }) }),
    );
  }

  if (options?.includeGroups) {
    entries[COLLECTIBLE_BACKUP_GROUPS_NAME] = strToU8(
      JSON.stringify(
        options.groups ?? [
          {
            id: 'group-1',
            name: 'Test Group',
            stationIds: [1, 2],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
        ],
      ),
    );
  }

  return zipSync(entries);
}

function populateRegistryFromZip(destPath: string, zipBytes: Uint8Array): void {
  const registry = fileSystemMock.__mockFileRegistry;
  const baseUri = destPath.startsWith('/') ? `file://${destPath}` : `file:///${destPath}`;

  for (const [path, bytes] of Object.entries(unzipSync(zipBytes))) {
    registry.set(`${baseUri}/${path}`, bytes);
  }
}

function mockNativeUnzipFromZip(zipBytes: Uint8Array): void {
  mockedNativeUnzip.mockImplementation(async (_src: string, destPath: string) => {
    populateRegistryFromZip(destPath, zipBytes);
  });
}

describe('collectibleBackup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fileSystemMock.__mockFileRegistry.clear();
    mockedListAll.mockReturnValue([]);
    mockedLoadProgress.mockResolvedValue({});
    mockedLoadGroups.mockResolvedValue([]);
    mockedGetDir.mockReturnValue({
      uri: 'file:///documents/station-collectibles/1/magnet',
      exists: true,
      list: jest.fn(() => []),
    } as never);
    mockedCopy.mockImplementation(async (_source, destination: { write: (bytes: Uint8Array) => void }) => {
      destination.write(new Uint8Array([1, 2, 3]));
    });
    mockedFileHasContent.mockResolvedValue(true);
    mockedFileLikelyHasContent.mockReturnValue(true);
    mockedReadSource.mockResolvedValue(new Uint8Array([1]));
    mockedGetInfoAsync.mockResolvedValue({ exists: true, size: 128 } as never);
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    mockedNativeUnzip.mockReset();
    mockNativeUnzipFromZip(buildImportZip());
  });

  describe('exportCollectibleArchive', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
      (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    });

    it('throws when there is nothing to export', async () => {
      await expect(exportCollectibleArchive()).rejects.toThrow('collectible-backup-nothing-to-export');
    });

    it('exports groups-only backups', async () => {
      mockedLoadGroups.mockResolvedValue([
        {
          id: 'group-1',
          name: 'Kanto',
          stationIds: [1, 2],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
      ]);

      const result = await exportCollectibleArchive();

      expect(result.fileCount).toBe(0);
      expect(result.progressStations).toBe(0);
      expect(result.groupCount).toBe(1);
      expect(Sharing.shareAsync).toHaveBeenCalled();
    });

    it('exports progress-only backups', async () => {
      mockedLoadProgress.mockResolvedValue({
        1: createProgressEntry({ visited: true }, { visited: 100, magnet: 0, magnet: 0, magnet: 0 }),
      });

      const result = await exportCollectibleArchive();

      expect(result.fileCount).toBe(0);
      expect(result.progressStations).toBe(1);
      expect(Sharing.shareAsync).toHaveBeenCalled();
    });

    it('exports collectible manifests', async () => {
      mockedListAll.mockReturnValue([
        {
          id: '1:magnet:page.jpg',
          stationId: 1,
          kind: 'magnet',
          uri: 'file:///mock/page.jpg',
          filename: 'page.jpg',
          mimeType: 'image/jpeg',
          createdAt: 100,
        },
      ]);

      const result = await exportCollectibleArchive();

      expect(result.fileCount).toBe(1);
      expect(result.progressStations).toBe(0);
      expect(Sharing.shareAsync).toHaveBeenCalled();
    });

    it('throws when sharing is unavailable on native', async () => {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
      (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false);
      mockedLoadProgress.mockResolvedValue({
        1: createProgressEntry({ visited: true }),
      });

      await expect(exportCollectibleArchive()).rejects.toThrow('collectible-backup-share-unavailable');
    });

    it('includes collectible bytes when source files exist on disk', async () => {
      mockedListAll.mockReturnValue([
        {
          id: '1:magnet:page.jpg',
          stationId: 1,
          kind: 'magnet',
          uri: 'file:///documents/station-collectibles/1/magnet/page.jpg',
          filename: 'page.jpg',
          mimeType: 'image/jpeg',
          createdAt: 100,
        },
      ]);
      mockedGetDir.mockReturnValue({
        uri: 'file:///documents/station-collectibles/1/magnet',
        exists: true,
        list: jest.fn(() => []),
      } as never);
      fileSystemMock.__mockFileRegistry.set(
        'file:///documents/station-collectibles/1/magnet/page.jpg',
        new Uint8Array([9, 9, 9]),
      );
      mockedReadSource.mockResolvedValue(new Uint8Array([9, 9, 9]));

      await exportCollectibleArchive();

      expect(mockedReadSource).toHaveBeenCalledWith(
        'file:///documents/station-collectibles/1/magnet/page.jpg',
      );
    });

    it('throws when exported zip file has no content', async () => {
      mockedLoadProgress.mockResolvedValue({
        1: createProgressEntry({ visited: true }),
      });
      mockedFileHasContent.mockImplementation(async (file: { uri?: string }) => {
        if (file.uri?.includes('japan-stations-backup')) {
          return false;
        }
        return true;
      });

      await expect(exportCollectibleArchive()).rejects.toThrow('collectible-backup-export-failed');
    });
  });

  describe('pickCollectibleArchive', () => {
    it('returns null when picker is cancelled', async () => {
      mockedGetDocumentAsync.mockResolvedValue({
        canceled: true,
        assets: [],
      } as never);

      await expect(pickCollectibleArchive()).resolves.toBeNull();
    });

    it('returns selected archive uri', async () => {
      mockedGetDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///picked/archive.zip' }],
      } as never);

      await expect(pickCollectibleArchive()).resolves.toBe('file:///picked/archive.zip');
    });
  });

  describe('importCollectibleArchive', () => {
    it('returns null when no archive is selected', async () => {
      mockedGetDocumentAsync.mockResolvedValue({
        canceled: true,
        assets: [],
      } as never);

      await expect(importCollectibleArchive()).resolves.toBeNull();
    });

    it('imports collectibles and progress from a selected archive', async () => {
      mockedGetDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///picked/backup.zip' }],
      } as never);

      const result = await importCollectibleArchive();

      expect(result).toMatchObject({
        imported: 1,
        skipped: 0,
        castlesUpdated: 1,
        groupsMerged: 0,
      });
      expect(mockedSaveProgress).toHaveBeenCalled();
    });
  });

  describe('processCollectibleImport', () => {
    it('imports groups-only archives in replace mode', async () => {
      mockNativeUnzipFromZip(
        zipSync({
          [COLLECTIBLE_BACKUP_GROUPS_NAME]: strToU8(
            JSON.stringify([
              {
                id: 'group-1',
                name: 'Imported Group',
                stationIds: [3],
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-03T00:00:00.000Z',
              },
            ]),
          ),
        }),
      );
      mockedLoadGroups.mockResolvedValue([]);

      const result = await processCollectibleImport('file:///picked/groups-only.zip', 'replace');

      expect(result.imported).toBe(0);
      expect(result.groupsMerged).toBe(1);
      expect(mockedSaveGroups).toHaveBeenCalledWith([
        {
          id: 'group-1',
          name: 'Imported Group',
          stationIds: [3],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-03T00:00:00.000Z',
        },
      ]);
    });

    it('merges groups by updatedAt in merge-newer mode', async () => {
      mockNativeUnzipFromZip(
        buildImportZip({
          includeCollectibleFile: false,
          includeProgress: false,
          includeGroups: true,
          groups: [
            {
              id: 'group-1',
              name: 'Imported Name',
              stationIds: [1],
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-05T00:00:00.000Z',
            },
          ],
        }),
      );
      mockedLoadGroups.mockResolvedValue([
        {
          id: 'group-1',
          name: 'Local Name',
          stationIds: [2],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
      ]);

      const result = await processCollectibleImport('file:///picked/groups-merge.zip', 'merge-newer');

      expect(result.groupsMerged).toBe(1);
      expect(mockedSaveGroups).toHaveBeenCalledWith([
        {
          id: 'group-1',
          name: 'Imported Name',
          stationIds: [1],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-05T00:00:00.000Z',
        },
      ]);
    });

    it('throws when groups.json is invalid', async () => {
      mockNativeUnzipFromZip(
        zipSync({
          [COLLECTIBLE_BACKUP_GROUPS_NAME]: strToU8('{not-json'),
        }),
      );

      await expect(processCollectibleImport('file:///picked/bad-groups.zip')).rejects.toThrow(
        'collectible-backup-invalid-groups',
      );
    });

    it('imports collectibles from a staged zip archive', async () => {
      const result = await processCollectibleImport('file:///picked/backup.zip', 'replace');

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
    });

    it('throws when archive has nothing new in merge-newer mode', async () => {
      mockedLoadProgress.mockResolvedValue({
        1: createProgressEntry({ visited: true, magnet: true }),
      });
      fileSystemMock.__mockFileRegistry.set(
        'file:///documents/station-collectibles/1/magnet/stamp.jpg',
        new Uint8Array([1]),
      );

      await expect(
        processCollectibleImport('file:///picked/backup.zip', 'merge-newer'),
      ).rejects.toThrow('collectible-backup-import-nothing-new');
    });

    it('throws when staging the archive fails', async () => {
      mockedCopy.mockRejectedValueOnce(new Error('copy failed'));

      await expect(processCollectibleImport('file:///bad/backup.zip')).rejects.toThrow(
        'collectible-backup-read-failed',
      );
    });

    it('accepts staged archives located only via legacy file info', async () => {
      mockedFileLikelyHasContent.mockReturnValueOnce(false);
      mockedFileHasContent.mockResolvedValueOnce(false);
      mockedGetInfoAsync.mockResolvedValueOnce({ exists: true, size: 256 } as never);

      const result = await processCollectibleImport('file:///picked/backup.zip', 'replace');

      expect(result.imported).toBe(1);
      expect(mockedGetInfoAsync).toHaveBeenCalled();
    });

    it('throws when native unzip fails on iOS', async () => {
      mockedNativeUnzip.mockRejectedValueOnce(new Error('unzip failed'));

      await expect(processCollectibleImport('file:///bad/backup.zip')).rejects.toThrow(
        'collectible-backup-invalid-archive',
      );
    });

    it('throws when staged archive cannot be validated after copy', async () => {
      mockedFileLikelyHasContent.mockReturnValue(false);
      mockedFileHasContent.mockResolvedValue(false);
      mockedGetInfoAsync.mockResolvedValue({ exists: false, size: 0 } as never);

      await expect(processCollectibleImport('file:///picked/empty.zip')).rejects.toThrow(
        'collectible-backup-read-failed',
      );
    });

    it('throws when native unzip leaves no manifest or collectibles', async () => {
      mockedNativeUnzip.mockImplementationOnce(async () => undefined);
      fileSystemMock.__mockFileRegistry.clear();

      await expect(processCollectibleImport('file:///empty/backup.zip')).rejects.toThrow(
        'collectible-backup-invalid-archive',
      );
    });

    it('imports progress-only archives without collectible files', async () => {
      mockNativeUnzipFromZip(
        zipSync({
          [COLLECTIBLE_BACKUP_PROGRESS_NAME]: strToU8(
            JSON.stringify({ 2: createProgressEntry({ visited: true }) }),
          ),
        }),
      );
      mockedLoadProgress.mockResolvedValue({});

      const result = await processCollectibleImport('file:///picked/progress-only.zip', 'replace');

      expect(result.imported).toBe(0);
      expect(result.progressMerged).toBe(1);
    });

    it('replaces an existing multi-file collectible in replace mode', async () => {
      mockedGetDir.mockImplementation((stationId: number, kind: string) => ({
        uri: `file:///documents/station-collectibles/${stationId}/${kind}`,
        exists: true,
        list: jest.fn(() => []),
      }));
      fileSystemMock.__mockFileRegistry.set(
        'file:///documents/station-collectibles/1/magnet/page.jpg',
        new Uint8Array([4, 4, 4]),
      );

      const result = await processCollectibleImport('file:///picked/replace-magnet.zip', 'replace');

      expect(result.imported).toBe(1);
    });

    it('merges imported progress in replace mode', async () => {
      mockedLoadProgress.mockResolvedValue({});
      mockNativeUnzipFromZip(buildImportZip({ includeProgress: true, includeCollectibleFile: false }));

      const result = await processCollectibleImport('file:///picked/progress-only.zip', 'replace');

      expect(result.progressMerged).toBe(1);
      expect(mockedSaveProgress).toHaveBeenCalled();
    });

    it('replaces existing magnet files in replace mode', async () => {
      mockNativeUnzipFromZip(buildImportZip({ kind: 'magnet' }));
      mockedGetDir.mockImplementation((stationId: number, kind: string) => ({
        uri: `file:///documents/station-collectibles/${stationId}/${kind}`,
        exists: true,
        list: jest.fn(() => []),
      }));
      fileSystemMock.__mockFileRegistry.set(
        'file:///documents/station-collectibles/1/magnet/stamp.jpg',
        new Uint8Array([1]),
      );

      const result = await processCollectibleImport('file:///picked/stamp.zip', 'replace');

      expect(mockedClearDir).not.toHaveBeenCalled();
      expect(result.imported).toBe(1);
    });

    it('skips missing source files listed in the manifest', async () => {
      mockNativeUnzipFromZip(
        buildImportZip({ includeCollectibleFile: false, includeProgress: false }),
      );

      const result = await processCollectibleImport('file:///picked/missing-file.zip', 'replace');

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it('skips collectibles when copy fails', async () => {
      mockedCopy
        .mockImplementationOnce(async (_source, destination: { write: (bytes: Uint8Array) => void }) => {
          destination.write(new Uint8Array([1, 2, 3]));
        })
        .mockRejectedValueOnce(new Error('copy failed'));

      const result = await processCollectibleImport('file:///picked/backup.zip', 'replace');

      expect(result.skipped).toBe(1);
      expect(result.imported).toBe(0);
    });

    it('skips collectibles when destination ends up empty', async () => {
      mockedCopy.mockImplementation(async (_source, destination) => {
        destination.write(new Uint8Array([1]));
      });
      mockedFileLikelyHasContent.mockReturnValue(false);
      mockedFileHasContent.mockResolvedValue(false);

      const result = await processCollectibleImport('file:///picked/backup.zip', 'replace');

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it('throws when progress.json is invalid', async () => {
      mockNativeUnzipFromZip(
        zipSync({
          [COLLECTIBLE_BACKUP_MANIFEST_NAME]: strToU8(
            JSON.stringify({
              version: COLLECTIBLE_BACKUP_VERSION,
              exportedAt: Date.now(),
              collectibles: [],
            }),
          ),
          [COLLECTIBLE_BACKUP_PROGRESS_NAME]: strToU8('{not-json'),
        }),
      );

      await expect(processCollectibleImport('file:///picked/bad-progress.zip')).rejects.toThrow(
        'collectible-backup-invalid-progress',
      );
    });

    it('reads manifests with a UTF-8 BOM', async () => {
      const manifest = JSON.stringify({
        version: COLLECTIBLE_BACKUP_VERSION,
        exportedAt: Date.now(),
        collectibles: [
          {
            stationId: 1,
            kind: 'magnet',
            filename: 'page.jpg',
            mimeType: 'image/jpeg',
            createdAt: 100,
            zipPath: 'station-collectibles/1/magnet/page.jpg',
          },
        ],
      });
      mockNativeUnzipFromZip(
        zipSync({
          [COLLECTIBLE_BACKUP_MANIFEST_NAME]: strToU8(`\uFEFF${manifest}`),
          'station-collectibles/1/magnet/page.jpg': strToU8('image-data'),
          [COLLECTIBLE_BACKUP_PROGRESS_NAME]: strToU8('{}'),
        }),
      );

      const result = await processCollectibleImport('file:///picked/bom.zip', 'replace');

      expect(result.imported).toBe(1);
    });

    it('rebuilds manifest by scanning extracted directories when manifest.json is invalid', async () => {
      mockNativeUnzipFromZip(
        zipSync({
          [COLLECTIBLE_BACKUP_MANIFEST_NAME]: strToU8('{invalid-manifest'),
          'station-collectibles/1/magnet/page.jpg': strToU8('image-data'),
          [COLLECTIBLE_BACKUP_PROGRESS_NAME]: strToU8(
            JSON.stringify({ 1: createProgressEntry({ visited: true }) }),
          ),
        }),
      );

      const result = await processCollectibleImport('file:///picked/rescan.zip', 'replace');

      expect(result.imported).toBe(1);
    });

    it('does not mark stations updated when progress is already collected', async () => {
      mockedLoadProgress.mockResolvedValue({
        1: createProgressEntry({ magnet: true }),
      });

      const result = await processCollectibleImport('file:///picked/backup.zip', 'replace');

      expect(result.imported).toBe(1);
      expect(result.castlesUpdated).toBe(0);
    });
  });
});
