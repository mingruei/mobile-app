import {
  DECORATIVE_MAX_FONT_SIZE_MULTIPLIER,
  UI_MAX_FONT_SIZE_MULTIPLIER,
  isLargeContentSize,
  scaledMinTouchTarget,
} from '../utils/dynamicType';
import { useFontScale } from './useFontScale';

export function useDynamicTypeLayout() {
  const fontScale = useFontScale();

  return {
    fontScale,
    minTouchTarget: scaledMinTouchTarget(fontScale),
    isLargeContentSize: isLargeContentSize(fontScale),
    uiMaxFontSizeMultiplier: UI_MAX_FONT_SIZE_MULTIPLIER,
    decorativeMaxFontSizeMultiplier: DECORATIVE_MAX_FONT_SIZE_MULTIPLIER,
  };
}
