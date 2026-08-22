import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

/**
 * Lock portrait on iOS phones only. Android defers to system orientation and
 * resize rules for large-screen / Play Console compliance.
 */
export function useConditionalPortraitLock() {
  const { width, height } = useWindowDimensions();
  const shortestSide = Math.min(width, height);
  const isLargeScreen = shortestSide >= 600;

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return undefined;
    }

    let active = true;

    const apply = async () => {
      if (!active) {
        return;
      }

      if (isLargeScreen) {
        await ScreenOrientation.unlockAsync();
        return;
      }

      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };

    void apply();

    return () => {
      active = false;
      void ScreenOrientation.unlockAsync();
    };
  }, [isLargeScreen]);
}
