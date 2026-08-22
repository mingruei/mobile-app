import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MapProvider } from '../types/mapProvider';
import { DEFAULT_IOS_MAP_PROVIDER } from '../types/mapProvider';

const MAP_PROVIDER_KEY = 'settings.mapProvider';

function isMapProvider(value: string | null): value is MapProvider {
  return value === 'apple' || value === 'google';
}

export async function loadMapProvider(): Promise<MapProvider> {
  const value = await AsyncStorage.getItem(MAP_PROVIDER_KEY);
  return isMapProvider(value) ? value : DEFAULT_IOS_MAP_PROVIDER;
}

export async function saveMapProvider(provider: MapProvider): Promise<void> {
  await AsyncStorage.setItem(MAP_PROVIDER_KEY, provider);
}
