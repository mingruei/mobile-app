import { Image } from 'react-native';

import type { CollectibleUploadSelection } from './stationCollectibleUpload';
import { normalizeFileUri } from './normalizeFileUri';

export type ImageDimensions = {
  width: number;
  height: number;
};

const DIMENSION_TIMEOUT_MS = 3_000;
const FALLBACK_DIMENSIONS: ImageDimensions = {
  width: 630,
  height: 880,
};

function getImageDimensionsFromUri(uri: string): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error),
    );
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('dimension-timeout')), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function resolveSelectionDimensions(
  selection: CollectibleUploadSelection,
): Promise<ImageDimensions> {
  if (selection.width && selection.height && selection.width > 0 && selection.height > 0) {
    return {
      width: selection.width,
      height: selection.height,
    };
  }

  const candidates = [
    normalizeFileUri(selection.uri),
    selection.uri,
  ].filter((value, index, array) => array.indexOf(value) === index);

  for (const uri of candidates) {
    try {
      return await withTimeout(getImageDimensionsFromUri(uri), DIMENSION_TIMEOUT_MS);
    } catch {
      // Try the next URI format.
    }
  }

  return FALLBACK_DIMENSIONS;
}
