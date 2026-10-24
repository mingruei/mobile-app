import { Directory, File, Paths } from 'expo-file-system';

import { fileHasContent, fileLikelyHasContent } from './collectibleFileIO';
import { normalizeFileUri } from './normalizeFileUri';

const CACHE_ROOT = 'station-photos';

function ensureDirectory(path: Directory): Directory {
  if (!path.exists) {
    path.create({ idempotent: true });
  }
  return path;
}

function getPhotoRootDirectory(): Directory {
  return new Directory(Paths.document, CACHE_ROOT);
}

function getPhotoVersionDirectory(dataVersion: number): Directory {
  return new Directory(getPhotoRootDirectory(), `v${dataVersion}`);
}

function ensurePhotoDirectory(dataVersion: number): Directory {
  const root = ensureDirectory(getPhotoRootDirectory());
  return ensureDirectory(new Directory(root, `v${dataVersion}`));
}

function getPhotoFile(stationId: number, dataVersion: number): File {
  return new File(getPhotoVersionDirectory(dataVersion), `${stationId}.jpg`);
}

export function getCachedStationPhotoUri(stationId: number, dataVersion: number): string | null {
  const file = getPhotoFile(stationId, dataVersion);
  if (!fileLikelyHasContent(file)) {
    return null;
  }

  return normalizeFileUri(file.uri);
}

export type ResolveStationPhotoUriInput = {
  stationId: number;
  imageUrl: string;
  dataVersion: number;
};

export async function resolveStationPhotoUri({
  stationId,
  imageUrl,
  dataVersion,
}: ResolveStationPhotoUriInput): Promise<string | null> {
  const cached = getCachedStationPhotoUri(stationId, dataVersion);
  if (cached) {
    return cached;
  }

  const destination = new File(ensurePhotoDirectory(dataVersion), `${stationId}.jpg`);
  if (destination.exists) {
    destination.delete();
  }

  try {
    await File.downloadFileAsync(imageUrl, destination, { idempotent: true });
    if (await fileHasContent(destination)) {
      return normalizeFileUri(destination.uri);
    }
  } catch {
    return null;
  }

  return null;
}
