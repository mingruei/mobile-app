import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createStationGroupId,
  loadStationGroups,
  saveStationGroups,
} from '../stationGroupStorage';
import type { StationGroup } from '../../types/stationGroup';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn(),
}));

const mockedGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>;
const mockedSetItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>;

describe('stationGroupStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an empty list when nothing is stored', async () => {
    mockedGetItem.mockResolvedValue(null);
    await expect(loadStationGroups()).resolves.toEqual([]);
  });

  it('round-trips saved groups', async () => {
    const groups: StationGroup[] = [
      {
        id: createStationGroupId(),
        name: '山陰',
        stationIds: [1, 2, 3],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    await saveStationGroups(groups);
    expect(mockedSetItem).toHaveBeenCalledWith(
      'station.groups.v1',
      JSON.stringify(groups),
    );

    mockedGetItem.mockResolvedValue(JSON.stringify(groups));
    await expect(loadStationGroups()).resolves.toEqual(groups);
  });

  it('ignores corrupt storage payloads', async () => {
    mockedGetItem.mockResolvedValue('{not-json');
    await expect(loadStationGroups()).resolves.toEqual([]);
  });

  it('ignores invalid group shapes', async () => {
    mockedGetItem.mockResolvedValue(
      JSON.stringify([{ id: 1, name: 'bad' }, { ok: true }]),
    );
    await expect(loadStationGroups()).resolves.toEqual([]);
  });
});
