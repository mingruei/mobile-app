jest.mock('../collectibleFileIO', () => ({
  fileHasContent: jest.fn(async () => true),
  fileLikelyHasContent: jest.fn(() => true),
  getDisplayImageUri: jest.fn((uri: string) => uri),
  isDirectoryEntry: jest.fn((entry: { extension?: string }) => !('extension' in entry)),
  isFileEntry: jest.fn((entry: { extension?: string }) => 'extension' in entry),
  writeSourceToNewFile: jest.fn(async (_source: string, _dir: unknown, filename: string) => ({
    exists: true,
    uri: `file:///mock/${filename}`,
    name: filename,
    info: () => ({ size: 10, modificationTime: 1_700_000_000 }),
    delete: jest.fn(),
  })),
}));

jest.mock('expo-file-system', () => {
  class MockFile {
    exists = false;
    uri: string;
    name: string;

    constructor(uri: string) {
      this.uri = uri;
      this.name = uri.split('/').pop() ?? 'file';
    }

    info = jest.fn(() => ({ size: this.exists ? 10 : 0 }));

    delete = jest.fn(() => {
      this.exists = false;
    });
  }

  class MockDirectory {
    exists = false;
    name: string;
    entries: unknown[] = [];

    constructor(_parent: unknown, name: string) {
      this.name = name;
    }

    create = jest.fn(function create(this: MockDirectory) {
      this.exists = true;
    });

    list = jest.fn(function list(this: MockDirectory) {
      return this.entries;
    });
  }

  return {
    File: MockFile,
    Directory: MockDirectory,
    Paths: { document: 'file:///documents' },
  };
});

import type { StationCollectible } from '../../types/stationCollectible';
import {
  deleteStationCollectible,
  getCollectibleDisplayUri,
  getCollectibleZipPath,
  isImageCollectible,
  listStationCollectibles,
  saveStationCollectibleFromUri,
} from '../stationCollectibleStorage';
import { writeSourceToNewFile } from '../collectibleFileIO';

const mockedWrite = writeSourceToNewFile as jest.MockedFunction<typeof writeSourceToNewFile>;

describe('stationCollectibleStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds zip paths for collectibles', () => {
    expect(getCollectibleZipPath(1, 'magnet', 'page.jpg')).toBe(
      'station-collectibles/1/magnet/page.jpg',
    );
  });

  it('returns empty lists when directories do not exist', () => {
    expect(listStationCollectibles(99, 'magnet')).toEqual([]);
  });

  it('saves collectibles from source URIs', async () => {
    mockedWrite.mockResolvedValue({
      exists: true,
      uri: 'file:///mock/magnet-123.jpg',
      name: 'magnet-123.jpg',
      info: () => ({ size: 10, modificationTime: 1_700_000_000 }),
      delete: jest.fn(),
    } as never);

    const item = await saveStationCollectibleFromUri(1, 'magnet', 'file:///source.jpg', 'image/jpeg');

    expect(item.stationId).toBe(1);
    expect(item.kind).toBe('magnet');
    expect(mockedWrite).toHaveBeenCalled();
  });

  it('returns display URIs for collectibles', () => {
    const item: StationCollectible = {
      id: '1:magnet:stamp.jpg',
      stationId: 1,
      kind: 'magnet',
      uri: 'file:///mock/stamp.jpg',
      filename: 'stamp.jpg',
      mimeType: 'image/jpeg',
      createdAt: 123,
    };

    expect(getCollectibleDisplayUri(item)).toBe('file:///mock/stamp.jpg');
  });

  it('deletes collectible files when they exist', () => {
    const item: StationCollectible = {
      id: '1:magnet:page.jpg',
      stationId: 1,
      kind: 'magnet',
      uri: 'file:///mock/page.jpg',
      filename: 'page.jpg',
      mimeType: 'image/jpeg',
      createdAt: 123,
    };

    deleteStationCollectible(item);
  });

  it('detects image collectibles by mime type or filename', () => {
    expect(
      isImageCollectible({
        id: '1',
        stationId: 1,
        kind: 'magnet',
        uri: 'file:///a.jpg',
        filename: 'a.jpg',
        mimeType: 'image/jpeg',
        createdAt: 1,
      }),
    ).toBe(true);
    expect(
      isImageCollectible({
        id: '1',
        stationId: 1,
        kind: 'magnet',
        uri: 'file:///a.pdf',
        filename: 'a.pdf',
        mimeType: 'application/pdf',
        createdAt: 1,
      }),
    ).toBe(false);
  });
});
