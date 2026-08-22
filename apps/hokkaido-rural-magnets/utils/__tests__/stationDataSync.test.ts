import type { Station } from '../../types/station';
import type { StationDataBundle } from '../../types/stationDataManifest';
import {
  REMOTE_MANIFEST,
  REMOTE_STATIONS,
} from './fixtures/stationDataRemote';

jest.mock('../stationDataConfig', () => ({
  getStationDataStorageBaseUrl: jest.fn(() => 'https://example.supabase.co/storage/v1/object/public/station-data'),
}));

jest.mock('../stationDataCache', () => ({
  loadCachedStationDataBundle: jest.fn(async () => null),
  saveCachedStationDataBundle: jest.fn(async () => undefined),
}));

import { getStationDataStorageBaseUrl } from '../stationDataConfig';
import {
  loadCachedStationDataBundle,
  saveCachedStationDataBundle,
} from '../stationDataCache';
import {
  BUNDLED_STATION_DATA_VERSION,
  fetchWithTimeout,
  getBundledStationDataBundle,
  loadInitialStationDataBundle,
  syncRemoteStationDataBundle,
} from '../stationDataSync';

const mockedFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
const mockedLoadCached = loadCachedStationDataBundle as jest.MockedFunction<typeof loadCachedStationDataBundle>;
const mockedSaveCached = saveCachedStationDataBundle as jest.MockedFunction<typeof saveCachedStationDataBundle>;
const mockedGetBaseUrl = getStationDataStorageBaseUrl as jest.MockedFunction<typeof getStationDataStorageBaseUrl>;

function jsonResponse(payload: unknown, ok = true): Response {
  return {
    ok,
    json: async () => payload,
  } as Response;
}

describe('stationDataSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = mockedFetch;
    mockedGetBaseUrl.mockReturnValue('https://example.supabase.co/storage/v1/object/public/station-data');
    mockedLoadCached.mockResolvedValue(null);
  });

  it('loads bundled data when cache is unavailable', async () => {
    const bundle = await loadInitialStationDataBundle();

    expect(bundle.version).toBe(BUNDLED_STATION_DATA_VERSION);
    expect(bundle.source).toBe('bundled');
    expect(bundle.stations.length).toBeGreaterThan(0);
  });

  it('prefers cached data when it is newer than the bundled version', async () => {
    const cached: StationDataBundle = {
      version: BUNDLED_STATION_DATA_VERSION + 1,
      updatedAt: '2026-08-09T00:00:00.000Z',
      stations: [{ id: 99, number: 99, name: 'Cached', prefecture: '東京都', city: '千代田区', location: '東京都', latitude: 1, longitude: 2 }] as Station[],
    };
    mockedLoadCached.mockResolvedValueOnce(cached);

    await expect(loadInitialStationDataBundle()).resolves.toEqual({
      ...cached,
      source: 'cache',
    });
  });

  it('skips remote sync when manifest version is not newer', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(REMOTE_MANIFEST));

    await expect(syncRemoteStationDataBundle(REMOTE_MANIFEST.version)).resolves.toBeNull();
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(mockedSaveCached).not.toHaveBeenCalled();
  });

  it('downloads and caches a full remote bundle when manifest is newer', async () => {
    mockedFetch
      .mockResolvedValueOnce(jsonResponse(REMOTE_MANIFEST))
      .mockResolvedValueOnce(jsonResponse(REMOTE_STATIONS));

    const bundle = await syncRemoteStationDataBundle(BUNDLED_STATION_DATA_VERSION);

    expect(bundle).toEqual({
      version: REMOTE_MANIFEST.version,
      updatedAt: REMOTE_MANIFEST.updatedAt,
      stations: REMOTE_STATIONS,
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
      'https://example.supabase.co/storage/v1/object/public/station-data/data-manifest.json',
      20,
    );
    jest.advanceTimersByTime(21);

    await expect(promise).rejects.toThrow();
    jest.useRealTimers();
  });

  it('returns null when remote base url is unavailable', async () => {
    mockedGetBaseUrl.mockReturnValueOnce(null);

    await expect(syncRemoteStationDataBundle(0)).resolves.toBeNull();
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('exposes bundled data synchronously for first render', () => {
    const bundled = getBundledStationDataBundle();

    expect(bundled.version).toBe(BUNDLED_STATION_DATA_VERSION);
    expect(bundled.stations.length).toBeGreaterThan(0);
  });
});
