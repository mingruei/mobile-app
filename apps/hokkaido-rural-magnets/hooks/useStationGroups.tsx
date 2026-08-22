import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { StationGroup } from '../types/stationGroup';
import {
  createStationGroupId,
  loadStationGroups,
  saveStationGroups,
} from '../utils/stationGroupStorage';

type StationGroupsContextValue = {
  groups: readonly StationGroup[];
  ready: boolean;
  createGroup: (
    name: string,
    stationIds: readonly number[],
    fallbackName?: string,
  ) => Promise<StationGroup>;
  updateGroup: (id: string, patch: { name?: string; stationIds?: readonly number[] }) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  reloadGroups: () => Promise<void>;
};

const StationGroupsContext = createContext<StationGroupsContextValue | null>(null);

export function StationGroupsProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<StationGroup[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void loadStationGroups().then((loaded) => {
      if (!active) {
        return;
      }
      setGroups(loaded);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback(async (next: StationGroup[]) => {
    setGroups(next);
    await saveStationGroups(next);
  }, []);

  const createGroup = useCallback(
    async (name: string, stationIds: readonly number[], fallbackName = '未命名群組') => {
      const now = new Date().toISOString();
      const group: StationGroup = {
        id: createStationGroupId(),
        name: name.trim() || fallbackName,
        stationIds: [...new Set(stationIds)],
        createdAt: now,
        updatedAt: now,
      };
      await persist([group, ...groups]);
      return group;
    },
    [groups, persist],
  );

  const updateGroup = useCallback(
    async (id: string, patch: { name?: string; stationIds?: readonly number[] }) => {
      const now = new Date().toISOString();
      const next = groups.map((group) => {
        if (group.id !== id) {
          return group;
        }
        return {
          ...group,
          name: patch.name !== undefined ? patch.name.trim() || group.name : group.name,
          stationIds: patch.stationIds !== undefined ? [...new Set(patch.stationIds)] : group.stationIds,
          updatedAt: now,
        };
      });
      await persist(next);
    },
    [groups, persist],
  );

  const deleteGroup = useCallback(
    async (id: string) => {
      await persist(groups.filter((group) => group.id !== id));
    },
    [groups, persist],
  );

  const reloadGroups = useCallback(async () => {
    const loaded = await loadStationGroups();
    setGroups(loaded);
  }, []);

  const value = useMemo(
    () => ({
      groups,
      ready,
      createGroup,
      updateGroup,
      deleteGroup,
      reloadGroups,
    }),
    [createGroup, deleteGroup, groups, ready, reloadGroups, updateGroup],
  );

  return <StationGroupsContext.Provider value={value}>{children}</StationGroupsContext.Provider>;
}

export function useStationGroups(): StationGroupsContextValue {
  const value = useContext(StationGroupsContext);
  if (!value) {
    throw new Error('useStationGroups must be used within StationGroupsProvider');
  }
  return value;
}
