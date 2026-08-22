import { Directory, Paths } from 'expo-file-system';

import { writeSourceToNewFile } from './collectibleFileIO';
import { normalizeFileUri } from './normalizeFileUri';

const UPLOAD_CACHE_DIR = 'upload-cache';

function ensureUploadCacheDirectory(): Directory {
  const directory = new Directory(Paths.cache, UPLOAD_CACHE_DIR);
  if (!directory.exists) {
    directory.create({ idempotent: true });
  }
  return directory;
}

type PersistUploadImageOptions = {
  base64Data?: string | null;
};

export async function persistUploadImage(
  sourceUri: string,
  mimeType = 'image/jpeg',
  options?: PersistUploadImageOptions,
): Promise<string> {
  const directory = ensureUploadCacheDirectory();
  const extension = mimeType.includes('png') ? '.png' : '.jpg';
  const destination = await writeSourceToNewFile(
    sourceUri,
    directory,
    `upload-${Date.now()}${extension}`,
    { base64Data: options?.base64Data },
  );

  if (!destination.exists) {
    throw new Error('Failed to persist upload image');
  }

  return normalizeFileUri(destination.uri);
}
