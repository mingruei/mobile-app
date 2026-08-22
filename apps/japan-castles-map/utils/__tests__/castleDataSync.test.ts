import type { Castle } from '../../types/castle';
import type { CastleDataBundle } from '../../types/castleDataManifest';
import {
  REMOTE_CASTLES,
  REMOTE_CONTENT,
  REMOTE_MANIFEST,
} from './fixtures/castleDataRemote';

jest.mock('../castleDataConfig', () => ({
  getCastleDataStorageBaseUrl: jest.fn(() => 'https://example.supabase.co/storage/v1/object/public/castle-data'),
}));

jest.mock('../castleDataCache', () => ({
  loadCachedCastleDataBundle: jest.fn(async () => null),
  saveCachedCastleDataBundle: jest.fn(async () => undefined),
}));

import { getCastleDataStorageBaseUrl } from '../castleDataConfig';
import {
  loadCachedCastleDataBundle,
  saveCachedCastleDataBundle,
} from '../castleDataCache';
import {
  BUNDLED_CASTLE_DATA_VERSION,
  fetchWithTimeout,
  getBundledCastleDataBundle,
  loadInitialCastleDataBundle,
  syncRemoteCastleDataBundle,
} from '../castleDataSync';

const mockedFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
const mockedLoadCached = loadCachedCastleDataBundle as jest.MockedFunction<typeof loadCachedCastleDataBundle>;
const mockedSaveCached = saveCachedCastleDataBundle as jest.MockedFunction<typeof saveCachedCastleDataBundle>;
const mockedGetBaseUrl = getCastleDataStorageBaseUrl as jest.MockedFunction<typeof getCastleDataStorageBaseUrl>;

function jsonResponse(payload: unknown, ok = true): Response {
  return {
    ok,
    json: async () => payload,
  } as Response;
}

describe('castleDataSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = mockedFetch;
    mockedGetBaseUrl.mockReturnValue('https://example.supabase.co/storage/v1/object/public/castle-data');
    mockedLoadCached.mockResolvedValue(null);
  });

  it('loads bundled data when cache is unavailable', async () => {
    const bundle = await loadInitialCastleDataBundle();

    expect(bundle.version).toBe(BUNDLED_CASTLE_DATA_VERSION);
    expect(bundle.source).toBe('bundled');
    expect(bundle.castles.length).toBeGreaterThan(0);
    expect(bundle.contentByLocale['zh-Hant']).toBeTruthy();
  });

  it('prefers cached data when it is newer than the bundled version', async () => {
    const cached: CastleDataBundle = {
      version: BUNDLED_CASTLE_DATA_VERSION + 1,
      updatedAt: '2026-08-09T00:00:00.000Z',
      castles: [{ id: 99, number: 99, name: 'Cached', series: 'original', seriesLabel: '日本100名城', prefecture: '東京都', city: '千代田区', location: '東京都', latitude: 1, longitude: 2 }] as Castle[],
      contentByLocale: {
        'zh-Hant': { '99': { subtitle: 'Cached' } },
      },
    };
    mockedLoadCached.mockResolvedValueOnce(cached);

    await expect(loadInitialCastleDataBundle()).resolves.toEqual({
      ...cached,
      source: 'cache',
    });
  });

  it('skips remote sync when manifest version is not newer', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(REMOTE_MANIFEST));

    await expect(syncRemoteCastleDataBundle(REMOTE_MANIFEST.version)).resolves.toBeNull();
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(mockedSaveCached).not.toHaveBeenCalled();
  });

  it('downloads and caches a full remote bundle when manifest is newer', async () => {
    mockedFetch
      .mockResolvedValueOnce(jsonResponse(REMOTE_MANIFEST))
      .mockResolvedValueOnce(jsonResponse(REMOTE_CASTLES))
      .mockResolvedValueOnce(jsonResponse(REMOTE_CONTENT));

    const bundle = await syncRemoteCastleDataBundle(BUNDLED_CASTLE_DATA_VERSION);

    expect(bundle).toEqual({
      version: REMOTE_MANIFEST.version,
      updatedAt: REMOTE_MANIFEST.updatedAt,
      castles: REMOTE_CASTLES,
      contentByLocale: {
        'zh-Hant': REMOTE_CONTENT,
      },
    });
    expect(mockedSaveCached).toHaveBeenCalledWith(bundle, REMOTE_MANIFEST);
  });

  it('aborts slow manifest requests', async () => {
    jest.useFakeTimers();
    mockedFetch.mockReset();
    mockedFetch.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      });
    }));

    const promise = fetchWithTimeout(
      'https://example.supabase.co/storage/v1/object/public/castle-data/data-manifest.json',
      20,
    );
    jest.advanceTimersByTime(21);

    await expect(promise).rejects.toThrow();
    jest.useRealTimers();
  });

  it('returns null when remote base url is unavailable', async () => {
    mockedGetBaseUrl.mockReturnValueOnce(null);

    await expect(syncRemoteCastleDataBundle(0)).resolves.toBeNull();
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('exposes bundled data synchronously for first render', () => {
    const bundled = getBundledCastleDataBundle();

    expect(bundled.version).toBe(BUNDLED_CASTLE_DATA_VERSION);
    expect(bundled.castles.length).toBeGreaterThan(0);
  });
});
