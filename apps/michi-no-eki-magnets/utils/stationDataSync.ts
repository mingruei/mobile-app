import bundledStations from '../assets/stations.json';
import bundledManifest from '../assets/data-manifest.json';
import type { Station } from '../types/station';
import type { StationDataBundle, StationDataManifest } from '../types/stationDataManifest';
import { getStationDataStorageBaseUrl } from './stationDataConfig';
import {
  loadCachedStationDataBundle,
  saveCachedStationDataBundle,
} from './stationDataCache';

const MANIFEST_TIMEOUT_MS = 3_000;
const DOWNLOAD_TIMEOUT_MS = 12_000;

export const BUNDLED_STATION_DATA_VERSION = bundledManifest.version;

export type StationDataSource = 'bundled' | 'cache' | 'remote';

export type LoadedStationDataBundle = StationDataBundle & {
  source: Exclude<StationDataSource, 'remote'>;
};

export function getBundledStationDataBundle(): StationDataBundle {
  return createBundledStationDataBundle();
}

function createBundledStationDataBundle(): StationDataBundle {
  return {
    version: bundledManifest.version,
    updatedAt: bundledManifest.updatedAt,
    stations: bundledStations as Station[],
  };
}

export async function loadInitialStationDataBundle(): Promise<LoadedStationDataBundle> {
  try {
    const cached = await loadCachedStationDataBundle();
    if (cached && cached.version >= bundledManifest.version) {
      return { ...cached, source: 'cache' };
    }
  } catch {
    // Fall back to the app bundle when cache is missing or invalid.
  }

  return { ...createBundledStationDataBundle(), source: 'bundled' };
}

function isStationArray(value: unknown): value is Station[] {
  return Array.isArray(value);
}

function isManifest(value: unknown): value is StationDataManifest {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  const manifest = value as StationDataManifest;
  return (
    typeof manifest.version === 'number'
    && manifest.version > 0
    && typeof manifest.updatedAt === 'string'
    && typeof manifest.files?.stations?.path === 'string'
  );
}

export async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function buildRemoteFileUrl(baseUrl: string, path: string): string {
  return `${baseUrl}/${path.replace(/^\//, '')}`;
}

async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs: number,
  validate: (value: unknown) => value is T,
): Promise<T | null> {
  try {
    const response = await fetchWithTimeout(url, timeoutMs);
    if (!response.ok) {
      return null;
    }

    const payload: unknown = await response.json();
    return validate(payload) ? payload : null;
  } catch {
    return null;
  }
}

export async function syncRemoteStationDataBundle(
  localVersion: number,
): Promise<StationDataBundle | null> {
  const baseUrl = getStationDataStorageBaseUrl();
  if (!baseUrl) {
    return null;
  }

  const manifestUrl = buildRemoteFileUrl(baseUrl, 'data-manifest.json');
  const manifest = await fetchJsonWithTimeout(manifestUrl, MANIFEST_TIMEOUT_MS, isManifest);
  if (!manifest || manifest.version <= localVersion) {
    return null;
  }

  const stationsUrl = buildRemoteFileUrl(baseUrl, manifest.files.stations.path);
  const stations = await fetchJsonWithTimeout(stationsUrl, DOWNLOAD_TIMEOUT_MS, isStationArray);

  if (!stations) {
    return null;
  }

  const bundle: StationDataBundle = {
    version: manifest.version,
    updatedAt: manifest.updatedAt,
    stations,
  };

  try {
    await saveCachedStationDataBundle(bundle, manifest);
  } catch {
    return null;
  }

  return bundle;
}
