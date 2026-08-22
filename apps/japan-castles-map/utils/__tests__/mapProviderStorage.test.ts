import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_IOS_MAP_PROVIDER } from '../../types/mapProvider';
import { loadMapProvider, saveMapProvider } from '../mapProviderStorage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockedGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>;
const mockedSetItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>;

describe('mapProviderStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads stored map provider values', async () => {
    mockedGetItem.mockResolvedValue('google');
    await expect(loadMapProvider()).resolves.toBe('google');
  });

  it('falls back to default when value is invalid', async () => {
    mockedGetItem.mockResolvedValue('invalid');
    await expect(loadMapProvider()).resolves.toBe(DEFAULT_IOS_MAP_PROVIDER);
  });

  it('persists map provider values', async () => {
    await saveMapProvider('apple');
    expect(mockedSetItem).toHaveBeenCalledWith('settings.mapProvider', 'apple');
  });
});
