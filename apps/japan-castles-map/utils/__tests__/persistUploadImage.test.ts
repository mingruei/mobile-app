jest.mock('../collectibleFileIO', () => ({
  writeSourceToNewFile: jest.fn(async (_source: string, _dir: unknown, filename: string) => ({
    exists: true,
    uri: `file:///cache/upload-cache/${filename}`,
    name: filename,
  })),
}));

jest.mock('expo-file-system', () => {
  class MockDirectory {
    exists = false;
    uri = 'file:///cache/upload-cache';

    create = jest.fn(function create(this: MockDirectory) {
      this.exists = true;
    });
  }

  return {
    Directory: MockDirectory,
    Paths: { cache: 'file:///cache' },
  };
});

import { persistUploadImage } from '../persistUploadImage';
import { writeSourceToNewFile } from '../collectibleFileIO';

const mockedWrite = writeSourceToNewFile as jest.MockedFunction<typeof writeSourceToNewFile>;

describe('persistUploadImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists jpeg uploads to cache directory', async () => {
    mockedWrite.mockResolvedValue({
      exists: true,
      uri: 'file:///cache/upload-cache/upload-1.jpg',
      name: 'upload-1.jpg',
    } as never);

    await expect(persistUploadImage('file:///source.jpg')).resolves.toBe(
      'file:///cache/upload-cache/upload-1.jpg',
    );
    expect(mockedWrite).toHaveBeenCalledWith(
      'file:///source.jpg',
      expect.objectContaining({ uri: 'file:///cache/upload-cache' }),
      expect.stringMatching(/^upload-\d+\.jpg$/),
      expect.any(Object),
    );
  });

  it('uses png extension for png mime types', async () => {
    mockedWrite.mockResolvedValue({
      exists: true,
      uri: 'file:///cache/upload-cache/upload-1.png',
      name: 'upload-1.png',
    } as never);

    await persistUploadImage('file:///source.png', 'image/png');
    expect(mockedWrite.mock.calls[0]?.[2]).toMatch(/\.png$/);
  });

  it('throws when destination file is missing after write', async () => {
    mockedWrite.mockResolvedValue({
      exists: false,
      uri: 'file:///cache/upload-cache/upload-1.jpg',
      name: 'upload-1.jpg',
    } as never);

    await expect(persistUploadImage('file:///source.jpg')).rejects.toThrow(
      'Failed to persist upload image',
    );
  });
});
