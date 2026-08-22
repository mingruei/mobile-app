import { Dimensions, PixelRatio } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useFontScale } from '../useFontScale';

describe('useFontScale', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the current font scale', async () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1.6);
    jest.spyOn(Dimensions, 'addEventListener').mockReturnValue({
      remove: jest.fn(),
    } as never);

    const { result } = renderHook(() => useFontScale());

    await waitFor(() => {
      expect(result.current).toBe(1.6);
    });
  });

  it('updates when dimensions change', async () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
    let changeHandler: (() => void) | undefined;
    jest.spyOn(Dimensions, 'addEventListener').mockImplementation((_event, handler) => {
      changeHandler = handler as () => void;
      return { remove: jest.fn() } as never;
    });

    const { result } = renderHook(() => useFontScale());

    await waitFor(() => {
      expect(result.current).toBe(1);
    });

    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);

    act(() => {
      changeHandler?.();
    });

    expect(result.current).toBe(2);
  });
});
