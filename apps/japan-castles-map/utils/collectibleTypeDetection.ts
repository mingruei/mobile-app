import type { CollectibleKind } from '../types/castleCollectible';
import type { ImageDimensions } from './getImageDimensions';

const ORIENTATION_TOLERANCE = 0.05;

export type CollectibleTypeSuggestion = {
  kind: CollectibleKind;
  confidence: 'high' | 'medium' | 'low';
};

export function detectCollectibleKind(dimensions: ImageDimensions): CollectibleTypeSuggestion {
  const { width, height } = dimensions;
  if (width <= 0 || height <= 0) {
    return { kind: 'goshuin', confidence: 'low' };
  }

  const aspectRatio = width / height;

  if (Math.abs(aspectRatio - 1) <= ORIENTATION_TOLERANCE) {
    return { kind: 'meijo-stamp', confidence: 'high' };
  }

  if (aspectRatio > 1 + ORIENTATION_TOLERANCE) {
    return { kind: 'castle-card', confidence: 'high' };
  }

  return { kind: 'goshuin', confidence: 'high' };
}
