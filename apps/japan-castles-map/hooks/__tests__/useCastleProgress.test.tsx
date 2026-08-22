import { act, renderHook, waitFor } from '@testing-library/react-native';
import React, { type ReactNode } from 'react';

import {
  CastleProgressProvider,
  useCastleProgress,
} from '../useCastleProgress';
import { loadProgressMap, saveProgressMap } from '../../utils/castleProgressStorage';
import { createProgressEntry } from '../../types/castleProgress';

jest.mock('../../utils/castleProgressStorage', () => ({
  loadProgressMap: jest.fn(async () => ({})),
  saveProgressMap: jest.fn(async () => undefined),
}));

const mockedLoad = loadProgressMap as jest.MockedFunction<typeof loadProgressMap>;
const mockedSave = saveProgressMap as jest.MockedFunction<typeof saveProgressMap>;

function wrapper({ children }: { children: ReactNode }) {
  return <CastleProgressProvider>{children}</CastleProgressProvider>;
}

describe('useCastleProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLoad.mockResolvedValue({
      1: createProgressEntry({ visited: true }),
    });
  });

  it('loads progress on mount', async () => {
    const { result } = renderHook(() => useCastleProgress(), { wrapper });

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.getProgress(1).visited).toBe(true);
  });

  it('toggles progress fields and persists updates', async () => {
    const { result } = renderHook(() => useCastleProgress(), { wrapper });

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    act(() => {
      result.current.toggleProgress(1, 'goshuin');
    });

    expect(result.current.getProgress(1).goshuin).toBe(true);
    expect(mockedSave).toHaveBeenCalled();
  });

  it('marks collected fields without clearing existing values', async () => {
    mockedLoad.mockResolvedValue({});
    const { result } = renderHook(() => useCastleProgress(), { wrapper });

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    act(() => {
      result.current.markProgressCollected(2, 'castleCard');
    });

    expect(result.current.getProgress(2).castleCard).toBe(true);

    act(() => {
      result.current.markProgressCollected(2, 'castleCard');
    });

    expect(result.current.getProgress(2).castleCard).toBe(true);
  });

  it('reloads progress from storage', async () => {
    const { result } = renderHook(() => useCastleProgress(), { wrapper });

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    mockedLoad.mockResolvedValue({
      3: createProgressEntry({ meijoStamp: true }),
    });

    await act(async () => {
      await result.current.reloadProgressMap();
    });

    expect(result.current.getProgress(3).meijoStamp).toBe(true);
  });

  it('throws when used outside provider', () => {
    expect(() => renderHook(() => useCastleProgress())).toThrow(
      'useCastleProgress must be used within CastleProgressProvider',
    );
  });
});
