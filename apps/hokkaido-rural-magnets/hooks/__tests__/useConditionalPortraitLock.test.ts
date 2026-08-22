import { renderHook, waitFor } from '@testing-library/react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Platform, useWindowDimensions } from 'react-native';

import { useConditionalPortraitLock } from '../useConditionalPortraitLock';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 })),
}));

jest.mock('expo-screen-orientation', () => ({
  unlockAsync: jest.fn(async () => undefined),
  lockAsync: jest.fn(async () => undefined),
  OrientationLock: { PORTRAIT_UP: 1 },
}));

const mockedDimensions = useWindowDimensions as jest.MockedFunction<typeof useWindowDimensions>;
const mockedUnlock = ScreenOrientation.unlockAsync as jest.MockedFunction<
  typeof ScreenOrientation.unlockAsync
>;
const mockedLock = ScreenOrientation.lockAsync as jest.MockedFunction<
  typeof ScreenOrientation.lockAsync
>;

describe('useConditionalPortraitLock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    mockedDimensions.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
  });

  it('locks portrait on phones', async () => {
    renderHook(() => useConditionalPortraitLock());

    await waitFor(() => {
      expect(mockedLock).toHaveBeenCalledWith(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    });
  });

  it('unlocks orientation on large screens', async () => {
    mockedDimensions.mockReturnValue({ width: 1024, height: 768, scale: 2, fontScale: 1 });

    renderHook(() => useConditionalPortraitLock());

    await waitFor(() => {
      expect(mockedUnlock).toHaveBeenCalled();
    });
    expect(mockedLock).not.toHaveBeenCalled();
  });
});
