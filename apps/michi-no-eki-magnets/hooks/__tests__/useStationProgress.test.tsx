import { act, renderHook, waitFor } from '@testing-library/react-native';
import React, { type ReactNode } from 'react';

import {
  StationProgressProvider,
  useStationProgress,
} from '../useStationProgress';
import { loadProgressMap, saveProgressMap } from '../../utils/stationProgressStorage';
import { createProgressEntry } from '../../types/stationProgress';

jest.mock('../../utils/stationProgressStorage', () => ({
  loadProgressMap: jest.fn(async () => ({})),
  saveProgressMap: jest.fn(async () => undefined),
}));

const mockedLoad = loadProgressMap as jest.MockedFunction<typeof loadProgressMap>;
const mockedSave = saveProgressMap as jest.MockedFunction<typeof saveProgressMap>;

function wrapper({ children }: { children: ReactNode }) {
  return <StationProgressProvider>{children}</StationProgressProvider>;
}

describe('useStationProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLoad.mockResolvedValue({
      1: createProgressEntry({ visited: true }),
    });
  });

  it('loads progress on mount', async () => {
    const { result } = renderHook(() => useStationProgress(), { wrapper });

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.getProgress(1).visited).toBe(true);
  });

  it('toggles progress fields and persists updates', async () => {
    const { result } = renderHook(() => useStationProgress(), { wrapper });

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    act(() => {
      result.current.toggleProgress(1, 'magnet');
    });

    expect(result.current.getProgress(1).magnet).toBe(true);
    expect(mockedSave).toHaveBeenCalled();
  });

  it('marks collected fields without clearing existing values', async () => {
    mockedLoad.mockResolvedValue({});
    const { result } = renderHook(() => useStationProgress(), { wrapper });

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    act(() => {
      result.current.markProgressCollected(2, 'magnet');
    });

    expect(result.current.getProgress(2).magnet).toBe(true);

    act(() => {
      result.current.markProgressCollected(2, 'magnet');
    });

    expect(result.current.getProgress(2).magnet).toBe(true);
  });

  it('reloads progress from storage', async () => {
    const { result } = renderHook(() => useStationProgress(), { wrapper });

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    mockedLoad.mockResolvedValue({
      3: createProgressEntry({ magnet: true }),
    });

    await act(async () => {
      await result.current.reloadProgressMap();
    });

    expect(result.current.getProgress(3).magnet).toBe(true);
  });

  it('clears magnet when magnetNotSold is toggled on', async () => {
    mockedLoad.mockResolvedValue({
      1: createProgressEntry({ magnet: true }),
    });
    const { result } = renderHook(() => useStationProgress(), { wrapper });

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    act(() => {
      result.current.toggleProgress(1, 'magnetNotSold');
    });

    expect(result.current.getProgress(1).magnetNotSold).toBe(true);
    expect(result.current.getProgress(1).magnet).toBe(false);
  });

  it('does not allow magnet when magnetNotSold is set', async () => {
    mockedLoad.mockResolvedValue({
      1: createProgressEntry({ magnetNotSold: true }),
    });
    const { result } = renderHook(() => useStationProgress(), { wrapper });

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    act(() => {
      result.current.toggleProgress(1, 'magnet');
    });

    expect(result.current.getProgress(1).magnet).toBe(false);
  });

  it('throws when used outside provider', () => {
    expect(() => renderHook(() => useStationProgress())).toThrow(
      'useStationProgress must be used within StationProgressProvider',
    );
  });
});
