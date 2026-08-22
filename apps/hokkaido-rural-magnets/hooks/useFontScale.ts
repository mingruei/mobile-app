import { useEffect, useState } from 'react';
import { Dimensions } from 'react-native';

import { getFontScale } from '../utils/dynamicType';

export function useFontScale(): number {
  const [fontScale, setFontScale] = useState(getFontScale);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', () => {
      setFontScale(getFontScale());
    });

    return () => subscription.remove();
  }, []);

  return fontScale;
}
