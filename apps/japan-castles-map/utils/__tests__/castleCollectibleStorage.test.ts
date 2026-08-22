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

import type { CastleCollectible } from '../../types/castleCollectible';
import {
  deleteCastleCollectible,
  getCollectibleDisplayUri,
  getCollectibleZipPath,
  isImageCollectible,
  listCastleCollectibles,
  saveCastleCollectibleFromUri,
} from '../castleCollectibleStorage';
import { writeSourceToNewFile } from '../collectibleFileIO';

const mockedWrite = writeSourceToNewFile as jest.MockedFunction<typeof writeSourceToNewFile>;

describe('castleCollectibleStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds zip paths for collectibles', () => {
    expect(getCollectibleZipPath(1, 'goshuin', 'page.jpg')).toBe(
      'castle-collectibles/1/goshuin/page.jpg',
    );
  });

  it('returns empty lists when directories do not exist', () => {
    expect(listCastleCollectibles(99, 'goshuin')).toEqual([]);
  });

  it('saves collectibles from source URIs', async () => {
    mockedWrite.mockResolvedValue({
      exists: true,
      uri: 'file:///mock/goshuin-123.jpg',
      name: 'goshuin-123.jpg',
      info: () => ({ size: 10, modificationTime: 1_700_000_000 }),
      delete: jest.fn(),
    } as never);

    const item = await saveCastleCollectibleFromUri(1, 'goshuin', 'file:///source.jpg', 'image/jpeg');

    expect(item.castleId).toBe(1);
    expect(item.kind).toBe('goshuin');
    expect(mockedWrite).toHaveBeenCalled();
  });

  it('adds cache busting for single-file collectible kinds', () => {
    const item: CastleCollectible = {
      id: '1:meijo-stamp:stamp.jpg',
      castleId: 1,
      kind: 'meijo-stamp',
      uri: 'file:///mock/stamp.jpg',
      filename: 'stamp.jpg',
      mimeType: 'image/jpeg',
      createdAt: 123,
    };

    expect(getCollectibleDisplayUri(item)).toBe('file:///mock/stamp.jpg?v=123');
  });

  it('deletes collectible files when they exist', () => {
    const item: CastleCollectible = {
      id: '1:goshuin:page.jpg',
      castleId: 1,
      kind: 'goshuin',
      uri: 'file:///mock/page.jpg',
      filename: 'page.jpg',
      mimeType: 'image/jpeg',
      createdAt: 123,
    };

    deleteCastleCollectible(item);
  });

  it('detects image collectibles by mime type or filename', () => {
    expect(
      isImageCollectible({
        id: '1',
        castleId: 1,
        kind: 'goshuin',
        uri: 'file:///a.jpg',
        filename: 'a.jpg',
        mimeType: 'image/jpeg',
        createdAt: 1,
      }),
    ).toBe(true);
    expect(
      isImageCollectible({
        id: '1',
        castleId: 1,
        kind: 'goshuin',
        uri: 'file:///a.pdf',
        filename: 'a.pdf',
        mimeType: 'application/pdf',
        createdAt: 1,
      }),
    ).toBe(false);
  });
});
