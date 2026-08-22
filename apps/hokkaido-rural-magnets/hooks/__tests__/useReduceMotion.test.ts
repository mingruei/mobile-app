import { AccessibilityInfo } from 'react-native';

import { renderHook, waitFor } from '@testing-library/react-native';

import { useReduceMotion } from '../useReduceMotion';

describe('useReduceMotion', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the current reduce motion setting', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({
      remove: jest.fn(),
    } as never);

    const { result } = renderHook(() => useReduceMotion());

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });
});
