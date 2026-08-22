import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { CastleGroup } from '../types/castleGroup';
import {
  createCastleGroupId,
  loadCastleGroups,
  saveCastleGroups,
} from '../utils/castleGroupStorage';

type CastleGroupsContextValue = {
  groups: readonly CastleGroup[];
  ready: boolean;
  createGroup: (
    name: string,
    castleIds: readonly number[],
    fallbackName?: string,
  ) => Promise<CastleGroup>;
  updateGroup: (id: string, patch: { name?: string; castleIds?: readonly number[] }) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  reloadGroups: () => Promise<void>;
};

const CastleGroupsContext = createContext<CastleGroupsContextValue | null>(null);

export function CastleGroupsProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<CastleGroup[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void loadCastleGroups().then((loaded) => {
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

  const persist = useCallback(async (next: CastleGroup[]) => {
    setGroups(next);
    await saveCastleGroups(next);
  }, []);

  const createGroup = useCallback(
    async (name: string, castleIds: readonly number[], fallbackName = '未命名群組') => {
      const now = new Date().toISOString();
      const group: CastleGroup = {
        id: createCastleGroupId(),
        name: name.trim() || fallbackName,
        castleIds: [...new Set(castleIds)],
        createdAt: now,
        updatedAt: now,
      };
      await persist([group, ...groups]);
      return group;
    },
    [groups, persist],
  );

  const updateGroup = useCallback(
    async (id: string, patch: { name?: string; castleIds?: readonly number[] }) => {
      const now = new Date().toISOString();
      const next = groups.map((group) => {
        if (group.id !== id) {
          return group;
        }
        return {
          ...group,
          name: patch.name !== undefined ? patch.name.trim() || group.name : group.name,
          castleIds: patch.castleIds !== undefined ? [...new Set(patch.castleIds)] : group.castleIds,
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
    const loaded = await loadCastleGroups();
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

  return <CastleGroupsContext.Provider value={value}>{children}</CastleGroupsContext.Provider>;
}

export function useCastleGroups(): CastleGroupsContextValue {
  const value = useContext(CastleGroupsContext);
  if (!value) {
    throw new Error('useCastleGroups must be used within CastleGroupsProvider');
  }
  return value;
}
