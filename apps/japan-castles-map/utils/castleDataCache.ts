import { File, Paths } from 'expo-file-system';

import type { Castle } from '../types/castle';
import type { CastleDataBundle, CastleDataManifest } from '../types/castleDataManifest';

const MANIFEST_FILE_NAME = 'castle-data-manifest.json';
const CASTLES_FILE_NAME = 'castle-data-castles.json';
const CONTENT_FILE_NAME = 'castle-data-content.zh-Hant.json';

function getManifestFile(): File {
  return new File(Paths.document, MANIFEST_FILE_NAME);
}

function getCastlesFile(): File {
  return new File(Paths.document, CASTLES_FILE_NAME);
}

function getContentFile(): File {
  return new File(Paths.document, CONTENT_FILE_NAME);
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
  return typeof manifest.version === 'number' && typeof manifest.updatedAt === 'string';
}

export async function loadCachedCastleDataBundle(): Promise<CastleDataBundle | null> {
  const manifestFile = getManifestFile();
  const castlesFile = getCastlesFile();
  const contentFile = getContentFile();

  if (!manifestFile.exists || !castlesFile.exists || !contentFile.exists) {
    return null;
  }

  try {
    const [manifestRaw, castlesRaw, contentRaw] = await Promise.all([
      manifestFile.text(),
      castlesFile.text(),
      contentFile.text(),
    ]);

    const manifest = JSON.parse(manifestRaw) as unknown;
    const castles = JSON.parse(castlesRaw) as unknown;
    const content = JSON.parse(contentRaw) as unknown;

    if (!isManifest(manifest) || !isCastleArray(castles) || !isContentMap(content)) {
      return null;
    }

    const contentLocale = manifest.files?.content?.locale ?? 'zh-Hant';

    return {
      version: manifest.version,
      updatedAt: manifest.updatedAt,
      castles,
      contentByLocale: {
        [contentLocale]: content,
      },
    };
  } catch {
    return null;
  }
}

export async function saveCachedCastleDataBundle(
  bundle: CastleDataBundle,
  manifest: CastleDataManifest,
): Promise<void> {
  const contentLocale = manifest.files.content.locale ?? 'zh-Hant';
  const content = bundle.contentByLocale[contentLocale];

  if (!content) {
    throw new Error('castle-data-content-missing');
  }

  getManifestFile().write(JSON.stringify(manifest));
  getCastlesFile().write(JSON.stringify(bundle.castles));
  getContentFile().write(JSON.stringify(content));
}
