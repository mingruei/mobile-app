import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { useWindowDimensions } from 'react-native';

/**
 * Lock portrait on phones only. Android 16+ ignores orientation locks on large
 * screens (>= 600dp shortest side); unlocking there avoids Play Console warnings.
 */
export function useConditionalPortraitLock() {
  const { width, height } = useWindowDimensions();
  const shortestSide = Math.min(width, height);
  const isLargeScreen = shortestSide >= 600;

  useEffect(() => {
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
