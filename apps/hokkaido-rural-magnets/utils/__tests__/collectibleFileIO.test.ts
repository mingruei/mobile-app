jest.mock('expo-file-system/legacy', () => ({
  copyAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  EncodingType: { Base64: 'base64' },
}));

jest.mock('expo-file-system', () => {
  class MockFile {
    exists = false;
    uri: string;
    name: string;

    constructor(uriOrDir: unknown, name?: string) {
      if (typeof uriOrDir === 'string' && name == null) {
        this.uri = uriOrDir;
        this.name = uriOrDir.split('/').pop() ?? 'file';
      } else {
        this.name = name ?? 'file';
        this.uri = `file:///mock/${this.name}`;
      }
    }

    info = jest.fn(() => ({ size: this.exists ? 10 : 0 }));

    bytesSync = jest.fn(() => (this.exists ? new Uint8Array([1, 2, 3]) : new Uint8Array()));

    bytes = jest.fn(async () => (this.exists ? new Uint8Array([1, 2, 3]) : new Uint8Array()));

    write = jest.fn(() => {
      this.exists = true;
    });

    delete = jest.fn(() => {
      this.exists = false;
    });
  }

  class MockDirectory {
    uri: string;
    name: string;

    constructor(_parent: unknown, name: string) {
      this.name = name;
      this.uri = `file:///mock/${name}`;
    }
  }

  return {
    File: MockFile,
    Directory: MockDirectory,
  };
});

import { Platform } from 'react-native';
import { copyAsync, getInfoAsync, readAsStringAsync } from 'expo-file-system/legacy';
import { File } from 'expo-file-system';

import {
  fileHasContent,
  fileLikelyHasContent,
  getDisplayImageUri,
  isDirectoryEntry,
  isFileEntry,
  readBinaryFileBytes,
  readSourceBytes,
  writeSourceToFile,
  writeSourceToNewFile,
} from '../collectibleFileIO';

const mockedCopyAsync = copyAsync as jest.MockedFunction<typeof copyAsync>;
const mockedGetInfoAsync = getInfoAsync as jest.MockedFunction<typeof getInfoAsync>;
const mockedReadAsStringAsync = readAsStringAsync as jest.MockedFunction<typeof readAsStringAsync>;

describe('collectibleFileIO', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    global.fetch = jest.fn();
  });

  it('detects file and directory entries', () => {
    const file = Object.assign(new File('file:///mock/test.jpg'), { extension: '.jpg' });
    const directory = { name: 'dir' };

    expect(isFileEntry(file)).toBe(true);
    expect(isDirectoryEntry(file)).toBe(false);
    expect(isDirectoryEntry(directory as never)).toBe(true);
  });

  it('normalizes display image URIs', () => {
    expect(getDisplayImageUri('/tmp/photo.jpg')).toBe('file:///tmp/photo.jpg');
    expect(getDisplayImageUri('file:///tmp/photo.jpg')).toBe('file:///tmp/photo.jpg');
    expect(getDisplayImageUri('content://media/1')).toBe('content://media/1');
  });

  it('reports file content from sync bytes', async () => {
    const file = new File('file:///mock/content.jpg');
    file.exists = true;

    await expect(fileHasContent(file)).resolves.toBe(true);
    expect(fileLikelyHasContent(file)).toBe(true);
  });

  it('writes source bytes from base64 data', async () => {
    const destination = new File('file:///mock/output.jpg');
    const base64 = Buffer.from('hello').toString('base64');

    await writeSourceToFile('file:///source.jpg', destination, { base64Data: base64 });

    expect(destination.write).toHaveBeenCalled();
    await expect(fileHasContent(destination)).resolves.toBe(true);
  });

  it('attempts native URI copy before falling back to byte writes', async () => {
    mockedCopyAsync.mockRejectedValue(new Error('copy failed'));
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([4, 5, 6]).buffer,
    });

    const destination = new File('file:///mock/copied.jpg');
    await writeSourceToFile('file:///source.jpg', destination);

    expect(mockedCopyAsync).toHaveBeenCalled();
    expect(destination.write).toHaveBeenCalled();
  });

  it('reads binary file bytes from sync data', async () => {
    const file = new File('file:///mock/read.jpg');
    file.exists = true;

    await expect(readBinaryFileBytes(file)).resolves.toEqual(new Uint8Array([1, 2, 3]));
  });

  it('reads source bytes from base64 data', async () => {
    const base64 = Buffer.from('abc').toString('base64');
    await expect(readSourceBytes('file:///ignored.jpg', base64)).resolves.toEqual(
      new Uint8Array([97, 98, 99]),
    );
  });

  it('reads source bytes via fetch fallback', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([9, 8, 7]).buffer,
    });

    await expect(readSourceBytes('https://example.com/image.jpg')).resolves.toEqual(
      new Uint8Array([9, 8, 7]),
    );
  });

  it('writes source bytes to a new file in a directory', async () => {
    const directory = { uri: 'file:///mock/dir' } as never;
    const base64 = Buffer.from('data').toString('base64');

    const file = await writeSourceToNewFile('file:///source.jpg', directory, 'upload.jpg', {
      base64Data: base64,
    });

    expect(file.uri).toContain('upload.jpg');
    expect(file.exists).toBe(true);
  });

  it('falls back to legacy base64 reads on Android', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    mockedReadAsStringAsync.mockResolvedValue(Buffer.from('xyz').toString('base64'));

    const file = new File('file:///mock/android.jpg');
    file.exists = true;
    file.bytes = jest.fn(async () => new Uint8Array());
    file.bytesSync = jest.fn(() => new Uint8Array());

    await expect(readBinaryFileBytes(file)).resolves.toEqual(new Uint8Array([120, 121, 122]));
  });

  it('returns false for missing files', async () => {
    const file = new File('file:///mock/missing.jpg');
    await expect(fileHasContent(file)).resolves.toBe(false);
    expect(fileLikelyHasContent(file)).toBe(false);
  });

  it('uses async bytes when sync metadata is empty', async () => {
    const file = new File('file:///mock/async.jpg');
    file.exists = true;
    file.info = jest.fn(() => ({ size: 0 }));
    file.bytesSync = jest.fn(() => new Uint8Array());
    file.bytes = jest.fn(async () => new Uint8Array([7, 8, 9]));

    await expect(fileHasContent(file)).resolves.toBe(true);
  });

  it('throws when binary reads fail for missing files', async () => {
    const file = new File('file:///mock/missing.bin');
    await expect(readBinaryFileBytes(file)).rejects.toThrow('Failed to read selected file');
  });

  it('throws when all source reads fail', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network'));
    mockedReadAsStringAsync.mockRejectedValue(new Error('legacy'));

    await expect(readSourceBytes('file:///missing.jpg')).rejects.toThrow('Failed to read selected file');
  });
});
