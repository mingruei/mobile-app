import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { CastleDataProvider } from '../useCastleData';
import { useCastleContent } from '../useCastleContent';
import { createCastle } from '../../utils/__tests__/fixtures';

jest.mock('../../i18n', () => ({
  useI18n: () => ({
    locale: 'zh-Hant',
    t: (key: string) => key,
    getPrefectureLabel: (prefecture: string) => prefecture,
  }),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <CastleDataProvider>{children}</CastleDataProvider>;
}

describe('useCastleContent', () => {
  it('returns localized castle content for the active locale', () => {
    const castle = createCastle({ id: 1, name: '姫路城' });
    const { result } = renderHook(() => useCastleContent(castle), { wrapper });

    expect(result.current.displayName).toBeTruthy();
    expect(result.current.locationLabel).toContain('兵庫');
  });
});
