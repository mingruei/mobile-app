import { PixelRatio } from 'react-native';

/** Minimum tappable area recommended by Apple HIG (pt). */
export const MIN_TOUCH_TARGET = 44;

/** Cap scaling on decorative micro-copy (map attribution, legend). */
export const DECORATIVE_MAX_FONT_SIZE_MULTIPLIER = 1.35;

/** Cap scaling on dense UI while still honoring larger accessibility sizes. */
export const UI_MAX_FONT_SIZE_MULTIPLIER = 2;

export const DYNAMIC_TYPE_TEST_SCALES = [1, 1.3, 1.6, 2] as const;

export type DynamicTypeTestScale = (typeof DYNAMIC_TYPE_TEST_SCALES)[number];

export function getFontScale(): number {
  return PixelRatio.getFontScale();
}

export function scaledMinTouchTarget(fontScale: number, base = 48): number {
  const cappedScale = Math.min(fontScale, UI_MAX_FONT_SIZE_MULTIPLIER);
  return Math.max(MIN_TOUCH_TARGET, Math.ceil(base * cappedScale));
}

export function isLargeContentSize(fontScale: number): boolean {
  return fontScale >= 1.3;
}
