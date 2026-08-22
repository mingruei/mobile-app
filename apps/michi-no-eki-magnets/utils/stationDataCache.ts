import { File, Paths } from 'expo-file-system';

import type { Station } from '../types/station';
import type { StationDataBundle, StationDataManifest } from '../types/stationDataManifest';

const MANIFEST_FILE_NAME = 'station-data-manifest.json';
const STATIONS_FILE_NAME = 'station-data-stations.json';

function getManifestFile(): File {
  return new File(Paths.document, MANIFEST_FILE_NAME);
}

function getStationsFile(): File {
  return new File(Paths.document, STATIONS_FILE_NAME);
}

function isStationArray(value: unknown): value is Station[] {
  return Array.isArray(value);
}

function isManifest(value: unknown): value is StationDataManifest {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  const manifest = value as StationDataManifest;
  return typeof manifest.version === 'number' && typeof manifest.updatedAt === 'string';
}

export async function loadCachedStationDataBundle(): Promise<StationDataBundle | null> {
  const manifestFile = getManifestFile();
  const stationsFile = getStationsFile();

  if (!manifestFile.exists || !stationsFile.exists) {
    return null;
  }

  try {
    const [manifestRaw, stationsRaw] = await Promise.all([
      manifestFile.text(),
      stationsFile.text(),
    ]);

    const manifest = JSON.parse(manifestRaw) as unknown;
    const stations = JSON.parse(stationsRaw) as unknown;

    if (!isManifest(manifest) || !isStationArray(stations)) {
      return null;
    }

    return {
      version: manifest.version,
      updatedAt: manifest.updatedAt,
      stations,
    };
  } catch {
    return null;
  }
}

export async function saveCachedStationDataBundle(
  bundle: StationDataBundle,
  manifest: StationDataManifest,
): Promise<void> {
  getManifestFile().write(JSON.stringify(manifest));
  getStationsFile().write(JSON.stringify(bundle.stations));
}
