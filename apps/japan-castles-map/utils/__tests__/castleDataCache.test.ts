import type { CastleDataBundle, CastleDataManifest } from '../../types/castleDataManifest';
import { loadCachedCastleDataBundle, saveCachedCastleDataBundle } from '../castleDataCache';

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

const MANIFEST_FILE = 'castle-data-manifest.json';
const CASTLES_FILE = 'castle-data-castles.json';
const CONTENT_FILE = 'castle-data-content.zh-Hant.json';

const manifest: CastleDataManifest = {
  version: 5,
  updatedAt: '2026-08-10T00:00:00.000Z',
  files: {
    castles: { path: 'castles.json' },
    content: { path: 'castle-content.zh-Hant.json', locale: 'zh-Hant' },
  },
};

const castles = [
  {
    id: 1,
    number: 1,
    name: 'Cached Castle',
    series: 'original',
    seriesLabel: '日本100名城',
    prefecture: '北海道',
    city: '根室市',
    location: '北海道根室市',
    latitude: 43.38,
    longitude: 145.81,
  },
];

const content = {
  '1': {
    subtitle: 'Cached Castle',
    description: 'Cached content',
  },
};

function seedCacheFiles(overrides?: {
  manifest?: unknown;
  castles?: unknown;
  content?: unknown;
}) {
  fileSystemMock.__fileStore.set(MANIFEST_FILE, {
    exists: true,
    content: JSON.stringify(overrides?.manifest ?? manifest),
  });
  fileSystemMock.__fileStore.set(CASTLES_FILE, {
    exists: true,
    content: JSON.stringify(overrides?.castles ?? castles),
  });
  fileSystemMock.__fileStore.set(CONTENT_FILE, {
    exists: true,
    content: JSON.stringify(overrides?.content ?? content),
  });
}

describe('castleDataCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fileSystemMock.__resetFileStore();
  });

  it('returns null when cache files are missing', async () => {
    await expect(loadCachedCastleDataBundle()).resolves.toBeNull();
  });

  it('returns null when cached payloads are invalid', async () => {
    seedCacheFiles({ manifest: { version: 'bad' } });
    await expect(loadCachedCastleDataBundle()).resolves.toBeNull();

    fileSystemMock.__resetFileStore();
    seedCacheFiles({ castles: [] });
    await expect(loadCachedCastleDataBundle()).resolves.toBeNull();

    fileSystemMock.__resetFileStore();
    seedCacheFiles({ content: [] });
    await expect(loadCachedCastleDataBundle()).resolves.toBeNull();
  });

  it('returns null when cached json cannot be parsed', async () => {
    fileSystemMock.__fileStore.set(MANIFEST_FILE, { exists: true, content: '{bad-json' });
    fileSystemMock.__fileStore.set(CASTLES_FILE, {
      exists: true,
      content: JSON.stringify(castles),
    });
    fileSystemMock.__fileStore.set(CONTENT_FILE, {
      exists: true,
      content: JSON.stringify(content),
    });

    await expect(loadCachedCastleDataBundle()).resolves.toBeNull();
  });

  it('loads a valid cached bundle', async () => {
    seedCacheFiles();

    await expect(loadCachedCastleDataBundle()).resolves.toEqual({
      version: 5,
      updatedAt: '2026-08-10T00:00:00.000Z',
      castles,
      contentByLocale: {
        'zh-Hant': content,
      },
    });
  });

  it('saves a bundle to the document cache', async () => {
    const bundle: CastleDataBundle = {
      version: 5,
      updatedAt: '2026-08-10T00:00:00.000Z',
      castles,
      contentByLocale: {
        'zh-Hant': content,
      },
    };

    await saveCachedCastleDataBundle(bundle, manifest);

    expect(fileSystemMock.__fileStore.get(MANIFEST_FILE)?.content).toBe(JSON.stringify(manifest));
    expect(fileSystemMock.__fileStore.get(CASTLES_FILE)?.content).toBe(JSON.stringify(castles));
    expect(fileSystemMock.__fileStore.get(CONTENT_FILE)?.content).toBe(JSON.stringify(content));
  });

  it('throws when saving without locale content', async () => {
    const bundle: CastleDataBundle = {
      version: 5,
      updatedAt: '2026-08-10T00:00:00.000Z',
      castles,
      contentByLocale: {},
    };

    await expect(saveCachedCastleDataBundle(bundle, manifest)).rejects.toThrow(
      'castle-data-content-missing',
    );
  });
});
