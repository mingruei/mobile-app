import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import type { MapProvider } from '../types/mapProvider';
import { DEFAULT_IOS_MAP_PROVIDER } from '../types/mapProvider';
import { loadMapProvider, saveMapProvider } from '../utils/mapProviderStorage';

type MapProviderContextValue = {
  mapProvider: MapProvider;
  setMapProvider: (provider: MapProvider) => Promise<void>;
};

const MapProviderContext = createContext<MapProviderContextValue | null>(null);

export function MapProviderProvider({ children }: { children: ReactNode }) {
  const [mapProvider, setMapProviderState] = useState<MapProvider>(DEFAULT_IOS_MAP_PROVIDER);

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }

    loadMapProvider().then(setMapProviderState);
  }, []);

  const setMapProvider = useCallback(async (provider: MapProvider) => {
    setMapProviderState(provider);
    if (Platform.OS === 'ios') {
      await saveMapProvider(provider);
    }
  }, []);

  const value = useMemo(
    () => ({
      mapProvider: Platform.OS === 'ios' ? mapProvider : 'google',
      setMapProvider,
    }),
    [mapProvider, setMapProvider],
  );

  return <MapProviderContext.Provider value={value}>{children}</MapProviderContext.Provider>;
}

export function useMapProvider(): MapProviderContextValue {
  const context = useContext(MapProviderContext);
  if (!context) {
    throw new Error('useMapProvider must be used within MapProviderProvider');
  }
  return context;
}
