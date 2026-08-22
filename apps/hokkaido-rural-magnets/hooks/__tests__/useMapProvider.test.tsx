import { act, renderHook, waitFor } from '@testing-library/react-native';
import React, { type ReactNode } from 'react';
import { Platform } from 'react-native';

import { MapProviderProvider, useMapProvider } from '../useMapProvider';
import { loadMapProvider, saveMapProvider } from '../../utils/mapProviderStorage';

jest.mock('../../utils/mapProviderStorage', () => ({
  loadMapProvider: jest.fn(async () => 'apple'),
  saveMapProvider: jest.fn(async () => undefined),
}));

const mockedLoad = loadMapProvider as jest.MockedFunction<typeof loadMapProvider>;
const mockedSave = saveMapProvider as jest.MockedFunction<typeof saveMapProvider>;

function wrapper({ children }: { children: ReactNode }) {
  return <MapProviderProvider>{children}</MapProviderProvider>;
}

describe('useMapProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  });

  it('loads stored provider on iOS', async () => {
    mockedLoad.mockResolvedValue('google');

    const { result } = renderHook(() => useMapProvider(), { wrapper });

    await waitFor(() => {
      expect(result.current.mapProvider).toBe('google');
    });
  });

  it('persists provider changes on iOS', async () => {
    const { result } = renderHook(() => useMapProvider(), { wrapper });

    await waitFor(() => {
      expect(result.current.mapProvider).toBe('apple');
    });

    await act(async () => {
      await result.current.setMapProvider('google');
    });

    expect(result.current.mapProvider).toBe('google');
    expect(mockedSave).toHaveBeenCalledWith('google');
  });

  it('always exposes google provider on Android', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });

    const { result } = renderHook(() => useMapProvider(), { wrapper });

    expect(result.current.mapProvider).toBe('google');
    expect(mockedLoad).not.toHaveBeenCalled();
  });

  it('throws when used outside provider', () => {
    expect(() => renderHook(() => useMapProvider())).toThrow(
      'useMapProvider must be used within MapProviderProvider',
    );
  });
});
