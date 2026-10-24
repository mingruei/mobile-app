jest.mock('../collectibleFileIO', () => ({
  fileHasContent: jest.fn(async (file: { exists: boolean }) => file.exists),
  fileLikelyHasContent: jest.fn((file: { exists: boolean }) => file.exists),
}));

jest.mock('expo-file-system', () => {
  const mockDownloadFileAsync = jest.fn();
  const directories = new Set<string>();
  const files = new Map<string, { exists: boolean }>();

  class MockDirectory {
    uri: string;
    exists: boolean;

    constructor(...parts: Array<string | MockDirectory>) {
      this.uri = parts
        .map((part) => (typeof part === 'string' ? part : part.uri))
        .join('/')
        .replace(/\/+/g, '/');
      this.exists = directories.has(this.uri);
    }

    create() {
      directories.add(this.uri);
      this.exists = true;
    }
  }

  class MockFile {
    uri: string;

    constructor(...parts: Array<string | MockDirectory>) {
      this.uri = parts
        .map((part) => (typeof part === 'string' ? part : part.uri))
        .join('/')
        .replace(/\/+/g, '/');
    }

    get exists(): boolean {
      return files.get(this.uri)?.exists ?? false;
    }

    delete() {
      files.delete(this.uri);
    }
  }

  return {
    Directory: MockDirectory,
    File: Object.assign(MockFile, {
      downloadFileAsync: (...args: unknown[]) => mockDownloadFileAsync(...args),
    }),
    Paths: { document: 'file:///documents' },
    __files: files,
    __mockDownloadFileAsync: mockDownloadFileAsync,
    __reset: () => {
      files.clear();
      directories.clear();
      mockDownloadFileAsync.mockReset();
    },
  };
});

import {
  getCachedStationPhotoUri,
  resolveStationPhotoUri,
} from '../stationPhotoCache';

const fileSystemMock = jest.requireMock('expo-file-system') as {
  __files: Map<string, { exists: boolean }>;
  __mockDownloadFileAsync: jest.Mock;
  __reset: () => void;
};

const DATA_VERSION = 4;
const STATION_ID = 1001;
const IMAGE_URL = 'https://commons.wikimedia.org/wiki/Special:FilePath/Michinoeki_Mikasa.jpg?width=800';

function cacheUri(stationId: number): string {
  return `file:/documents/station-photos/v${DATA_VERSION}/${stationId}.jpg`;
}

describe('stationPhotoCache', () => {
  beforeEach(() => {
    fileSystemMock.__reset();
  });

  it('returns null when no cached photo exists', () => {
    expect(getCachedStationPhotoUri(STATION_ID, DATA_VERSION)).toBeNull();
  });

  it('returns a cached photo uri when the file exists', () => {
    fileSystemMock.__files.set(cacheUri(STATION_ID), { exists: true });
    expect(getCachedStationPhotoUri(STATION_ID, DATA_VERSION)).toBe(cacheUri(STATION_ID));
  });

  it('returns cached uri without downloading', async () => {
    fileSystemMock.__files.set(cacheUri(STATION_ID), { exists: true });

    await expect(
      resolveStationPhotoUri({
        stationId: STATION_ID,
        imageUrl: IMAGE_URL,
        dataVersion: DATA_VERSION,
      }),
    ).resolves.toBe(cacheUri(STATION_ID));

    expect(fileSystemMock.__mockDownloadFileAsync).not.toHaveBeenCalled();
  });

  it('downloads and returns a photo uri when cache is missing', async () => {
    fileSystemMock.__mockDownloadFileAsync.mockImplementation(async (_url: string, destination: { uri: string }) => {
      fileSystemMock.__files.set(destination.uri, { exists: true });
      return destination;
    });

    await expect(
      resolveStationPhotoUri({
        stationId: STATION_ID,
        imageUrl: IMAGE_URL,
        dataVersion: DATA_VERSION,
      }),
    ).resolves.toBe(cacheUri(STATION_ID));

    expect(fileSystemMock.__mockDownloadFileAsync).toHaveBeenCalledWith(
      IMAGE_URL,
      expect.objectContaining({ uri: cacheUri(STATION_ID) }),
      { idempotent: true },
    );
  });

  it('returns null when download fails', async () => {
    fileSystemMock.__mockDownloadFileAsync.mockRejectedValue(new Error('offline'));

    await expect(
      resolveStationPhotoUri({
        stationId: STATION_ID,
        imageUrl: IMAGE_URL,
        dataVersion: DATA_VERSION,
      }),
    ).resolves.toBeNull();
  });
});
