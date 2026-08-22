import type { StationDataBundle, StationDataManifest } from '../../types/stationDataManifest';
import { loadCachedStationDataBundle, saveCachedStationDataBundle } from '../stationDataCache';

jest.mock('expo-file-system', () => {
  const fileStore = new Map<string, { exists: boolean; content: string }>();

  class MockFile {
    name: string;
    exists: boolean;

    constructor(_dir: unknown, name: string) {
      this.name = name;
      const entry = fileStore.get(name);
      this.exists = entry?.exists ?? false;

      this.text = jest.fn(async () => entry?.content ?? '');
      this.write = jest.fn((payload: string) => {
        fileStore.set(name, { exists: true, content: payload });
        this.exists = true;
      });
    }

    text: jest.Mock<Promise<string>, []>;
    write: jest.Mock<void, [string]>;
  }

  return {
    File: MockFile,
    Paths: { document: 'file:///documents' },
    __fileStore: fileStore,
    __resetFileStore: () => fileStore.clear(),
  };
});

const fileSystemMock = jest.requireMock('expo-file-system') as {
  __fileStore: Map<string, { exists: boolean; content: string }>;
  __resetFileStore: () => void;
};

const MANIFEST_FILE = 'station-data-manifest.json';
const STATIONS_FILE = 'station-data-stations.json';

const manifest: StationDataManifest = {
  version: 5,
  updatedAt: '2026-08-10T00:00:00.000Z',
  files: {
    stations: { path: 'stations.json' },
  },
};

const stations = [
  {
    id: 1,
    number: 1,
    name: 'Cached Station',
    prefecture: '北海道',
    city: '美瑛町',
    location: '北海道美瑛町',
    latitude: 43.38,
    longitude: 142.46,
  },
];

function seedCacheFiles(overrides?: {
  manifest?: unknown;
  stations?: unknown;
}) {
  fileSystemMock.__fileStore.set(MANIFEST_FILE, {
    exists: true,
    content: JSON.stringify(overrides?.manifest ?? manifest),
  });
  fileSystemMock.__fileStore.set(STATIONS_FILE, {
    exists: true,
    content: JSON.stringify(overrides?.stations ?? stations),
  });
}

describe('stationDataCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fileSystemMock.__resetFileStore();
  });

  it('returns null when cache files are missing', async () => {
    await expect(loadCachedStationDataBundle()).resolves.toBeNull();
  });

  it('returns null when cached payloads are invalid', async () => {
    seedCacheFiles({ manifest: { version: 'bad' } });
    await expect(loadCachedStationDataBundle()).resolves.toBeNull();
  });

  it('returns null when cached json cannot be parsed', async () => {
    fileSystemMock.__fileStore.set(MANIFEST_FILE, { exists: true, content: '{bad-json' });
    fileSystemMock.__fileStore.set(STATIONS_FILE, {
      exists: true,
      content: JSON.stringify(stations),
    });

    await expect(loadCachedStationDataBundle()).resolves.toBeNull();
  });

  it('loads a valid cached bundle', async () => {
    seedCacheFiles();

    await expect(loadCachedStationDataBundle()).resolves.toEqual({
      version: 5,
      updatedAt: '2026-08-10T00:00:00.000Z',
      stations,
    });
  });

  it('saves a bundle to the document cache', async () => {
    const bundle: StationDataBundle = {
      version: 5,
      updatedAt: '2026-08-10T00:00:00.000Z',
      stations,
    };

    await saveCachedStationDataBundle(bundle, manifest);

    expect(fileSystemMock.__fileStore.get(MANIFEST_FILE)?.content).toBe(JSON.stringify(manifest));
    expect(fileSystemMock.__fileStore.get(STATIONS_FILE)?.content).toBe(JSON.stringify(stations));
  });
});
