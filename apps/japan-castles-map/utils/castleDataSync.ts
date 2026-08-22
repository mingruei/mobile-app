import bundledCastles from '../assets/castles.json';
import bundledManifest from '../assets/data-manifest.json';
import bundledCastleContentZhHant from '../assets/i18n/castle-content.zh-Hant.json';
import type { Castle } from '../types/castle';
import type { CastleDataBundle, CastleDataManifest } from '../types/castleDataManifest';
import { getCastleDataStorageBaseUrl } from './castleDataConfig';
import {
  loadCachedCastleDataBundle,
  saveCachedCastleDataBundle,
} from './castleDataCache';

const MANIFEST_TIMEOUT_MS = 3_000;
const DOWNLOAD_TIMEOUT_MS = 12_000;

export const BUNDLED_CASTLE_DATA_VERSION = bundledManifest.version;

export type CastleDataSource = 'bundled' | 'cache' | 'remote';

export type LoadedCastleDataBundle = CastleDataBundle & {
  source: Exclude<CastleDataSource, 'remote'>;
};

export function getBundledCastleDataBundle(): CastleDataBundle {
  return createBundledCastleDataBundle();
}

function createBundledCastleDataBundle(): CastleDataBundle {
  return {
    version: bundledManifest.version,
    updatedAt: bundledManifest.updatedAt,
    castles: bundledCastles as Castle[],
    contentByLocale: {
      'zh-Hant': bundledCastleContentZhHant as Record<string, unknown>,
    },
  };
}

export async function loadInitialCastleDataBundle(): Promise<LoadedCastleDataBundle> {
  try {
    const cached = await loadCachedCastleDataBundle();
    if (cached && cached.version >= bundledManifest.version) {
      return { ...cached, source: 'cache' };
    }
  } catch {
    // Fall back to the app bundle when cache is missing or invalid.
  }

  return { ...createBundledCastleDataBundle(), source: 'bundled' };
}

function isCastleArray(value: unknown): value is Castle[] {
  return Array.isArray(value) && value.length > 0 && typeof value[0]?.id === 'number';
}

function isContentMap(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

function isManifest(value: unknown): value is CastleDataManifest {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  const manifest = value as CastleDataManifest;
  return (
    typeof manifest.version === 'number'
    && manifest.version > 0
    && typeof manifest.updatedAt === 'string'
    && typeof manifest.files?.castles?.path === 'string'
    && typeof manifest.files?.content?.path === 'string'
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

export async function syncRemoteCastleDataBundle(
  localVersion: number,
): Promise<CastleDataBundle | null> {
  const baseUrl = getCastleDataStorageBaseUrl();
  if (!baseUrl) {
    return null;
  }

  const manifestUrl = buildRemoteFileUrl(baseUrl, 'data-manifest.json');
  const manifest = await fetchJsonWithTimeout(manifestUrl, MANIFEST_TIMEOUT_MS, isManifest);
  if (!manifest || manifest.version <= localVersion) {
    return null;
  }

  const castlesUrl = buildRemoteFileUrl(baseUrl, manifest.files.castles.path);
  const contentUrl = buildRemoteFileUrl(baseUrl, manifest.files.content.path);
  const contentLocale = manifest.files.content.locale ?? 'zh-Hant';

  const [castles, content] = await Promise.all([
    fetchJsonWithTimeout(castlesUrl, DOWNLOAD_TIMEOUT_MS, isCastleArray),
    fetchJsonWithTimeout(contentUrl, DOWNLOAD_TIMEOUT_MS, isContentMap),
  ]);

  if (!castles || !content) {
    return null;
  }

  const bundle: CastleDataBundle = {
    version: manifest.version,
    updatedAt: manifest.updatedAt,
    castles,
    contentByLocale: {
      [contentLocale]: content,
    },
  };

  try {
    await saveCachedCastleDataBundle(bundle, manifest);
  } catch {
    return null;
  }

  return bundle;
}
