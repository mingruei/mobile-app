import type { CollectibleKind } from '../types/stationCollectible';
import type { ImageDimensions } from './getImageDimensions';

const ORIENTATION_TOLERANCE = 0.05;

export type CollectibleTypeSuggestion = {
  kind: CollectibleKind;
  confidence: 'high' | 'medium' | 'low';
};

export function detectCollectibleKind(dimensions: ImageDimensions): CollectibleTypeSuggestion {
  const { width, height } = dimensions;
  if (width <= 0 || height <= 0) {
    return { kind: 'magnet', confidence: 'low' };
  }

  const aspectRatio = width / height;

  if (Math.abs(aspectRatio - 1) <= ORIENTATION_TOLERANCE) {
    return { kind: 'magnet', confidence: 'high' };
  }

  if (aspectRatio > 1 + ORIENTATION_TOLERANCE) {
    return { kind: 'magnet', confidence: 'high' };
  }

  return { kind: 'magnet', confidence: 'high' };
}
