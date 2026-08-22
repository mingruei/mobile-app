import { act, renderHook, waitFor } from '@testing-library/react-native';
import React, { type ReactNode } from 'react';

import type { StationGroup } from '../../types/stationGroup';
import {
  createStationGroupId,
  loadStationGroups,
  saveStationGroups,
} from '../../utils/stationGroupStorage';
import { StationGroupsProvider, useStationGroups } from '../useStationGroups';

jest.mock('../../utils/stationGroupStorage', () => ({
  createStationGroupId: jest.fn(() => 'group-test-id'),
  loadStationGroups: jest.fn(async () => []),
  saveStationGroups: jest.fn(async () => undefined),
}));

const mockedLoad = loadStationGroups as jest.MockedFunction<typeof loadStationGroups>;
const mockedSave = saveStationGroups as jest.MockedFunction<typeof saveStationGroups>;
const mockedCreateId = createStationGroupId as jest.MockedFunction<typeof createStationGroupId>;

function wrapper({ children }: { children: ReactNode }) {
  return <StationGroupsProvider>{children}</StationGroupsProvider>;
}

describe('useStationGroups', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCreateId.mockReturnValue('group-test-id');
    mockedLoad.mockResolvedValue([]);
  });

  it('loads groups on mount', async () => {
    const stored: StationGroup[] = [
      {
        id: 'group-1',
        name: '山陰',
        stationIds: [1, 2],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    mockedLoad.mockResolvedValue(stored);

    const { result } = renderHook(() => useStationGroups(), { wrapper });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    expect(result.current.groups).toEqual(stored);
  });

  it('creates a group and persists it', async () => {
    const { result } = renderHook(() => useStationGroups(), { wrapper });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    let created: StationGroup | undefined;
    await act(async () => {
      created = await result.current.createGroup('山陰巡城', [1, 2, 2]);
    });

    expect(created).toEqual({
      id: 'group-test-id',
      name: '山陰巡城',
      stationIds: [1, 2],
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(result.current.groups).toHaveLength(1);
    expect(mockedSave).toHaveBeenCalledWith([created]);
  });

  it('uses fallback name when create name is blank', async () => {
    const { result } = renderHook(() => useStationGroups(), { wrapper });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    await act(async () => {
      await result.current.createGroup('   ', [3], '備用群組');
    });

    expect(result.current.groups[0]?.name).toBe('備用群組');
  });

  it('updates and deletes groups', async () => {
    mockedLoad.mockResolvedValue([
      {
        id: 'group-1',
        name: '舊名稱',
        stationIds: [1],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const { result } = renderHook(() => useStationGroups(), { wrapper });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    await act(async () => {
      await result.current.updateGroup('group-1', { name: '新名稱', stationIds: [1, 2, 2] });
    });

    expect(result.current.groups[0]).toMatchObject({
      id: 'group-1',
      name: '新名稱',
      stationIds: [1, 2],
    });

    await act(async () => {
      await result.current.updateGroup('group-1', { name: '   ' });
    });

    expect(result.current.groups[0]?.name).toBe('新名稱');

    await act(async () => {
      await result.current.deleteGroup('group-1');
    });

    expect(result.current.groups).toEqual([]);
    expect(mockedSave).toHaveBeenCalledTimes(3);
  });

  it('throws when used outside provider', () => {
    expect(() => renderHook(() => useStationGroups())).toThrow(
      'useStationGroups must be used within StationGroupsProvider',
    );
  });
});
