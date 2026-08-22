import { PixelRatio } from 'react-native';

import {
  DYNAMIC_TYPE_TEST_SCALES,
  getFontScale,
  isLargeContentSize,
  scaledMinTouchTarget,
} from '../dynamicType';

describe('dynamicType utilities', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exposes standard test scales up to accessibility size 2', () => {
    expect(DYNAMIC_TYPE_TEST_SCALES).toEqual([1, 1.3, 1.6, 2]);
  });

  it('reads the current font scale from PixelRatio', () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1.6);
    expect(getFontScale()).toBe(1.6);
  });

  it('never returns a touch target below 44pt', () => {
    expect(scaledMinTouchTarget(1)).toBe(48);
    expect(scaledMinTouchTarget(0.8)).toBe(44);
  });

  it('grows touch targets for larger content sizes', () => {
    expect(scaledMinTouchTarget(1.6)).toBeGreaterThan(48);
    expect(scaledMinTouchTarget(2)).toBeGreaterThan(scaledMinTouchTarget(1.6));
  });

  it('flags large content sizes from 1.3 and above', () => {
    expect(isLargeContentSize(1)).toBe(false);
    expect(isLargeContentSize(1.29)).toBe(false);
    expect(isLargeContentSize(1.3)).toBe(true);
    expect(isLargeContentSize(2)).toBe(true);
  });
});
