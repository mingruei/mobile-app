import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createCastleGroupId,
  loadCastleGroups,
  saveCastleGroups,
} from '../castleGroupStorage';
import type { CastleGroup } from '../../types/castleGroup';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn(),
}));

const mockedGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>;
const mockedSetItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>;

describe('castleGroupStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an empty list when nothing is stored', async () => {
    mockedGetItem.mockResolvedValue(null);
    await expect(loadCastleGroups()).resolves.toEqual([]);
  });

  it('round-trips saved groups', async () => {
    const groups: CastleGroup[] = [
      {
        id: createCastleGroupId(),
        name: '山陰',
        castleIds: [1, 2, 3],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    await saveCastleGroups(groups);
    expect(mockedSetItem).toHaveBeenCalledWith(
      'castle.groups.v1',
      JSON.stringify(groups),
    );

    mockedGetItem.mockResolvedValue(JSON.stringify(groups));
    await expect(loadCastleGroups()).resolves.toEqual(groups);
  });

  it('ignores corrupt storage payloads', async () => {
    mockedGetItem.mockResolvedValue('{not-json');
    await expect(loadCastleGroups()).resolves.toEqual([]);
  });

  it('ignores invalid group shapes', async () => {
    mockedGetItem.mockResolvedValue(
      JSON.stringify([{ id: 1, name: 'bad' }, { ok: true }]),
    );
    await expect(loadCastleGroups()).resolves.toEqual([]);
  });
});
