import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  EMPTY_CASTLE_PROGRESS_ENTRY,
  withFieldUpdate,
  type CastleProgressEntry,
  type CastleProgressField,
  type CastleProgressMap,
} from '../types/castleProgress';
import { loadProgressMap, saveProgressMap } from '../utils/castleProgressStorage';

type CastleProgressContextValue = {
  loaded: boolean;
  progressMap: CastleProgressMap;
  getProgress: (castleId: number) => CastleProgressEntry;
  toggleProgress: (castleId: number, field: CastleProgressField) => void;
  markProgressCollected: (castleId: number, field: CastleProgressField) => void;
  reloadProgressMap: () => Promise<void>;
};

const CastleProgressContext = createContext<CastleProgressContextValue | null>(null);

export function CastleProgressProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [progressMap, setProgressMap] = useState<CastleProgressMap>({});

  useEffect(() => {
    let active = true;

    loadProgressMap()
      .then((map) => {
        if (active) {
          setProgressMap(map);
        }
      })
      .catch(() => {
        if (active) {
          setProgressMap({});
        }
      })
      .finally(() => {
        if (active) {
          setLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback((nextMap: CastleProgressMap) => {
    void saveProgressMap(nextMap).catch(() => undefined);
  }, []);

  const getProgress = useCallback(
    (castleId: number) => progressMap[castleId] ?? EMPTY_CASTLE_PROGRESS_ENTRY,
    [progressMap],
  );

  const toggleProgress = useCallback(
    (castleId: number, field: CastleProgressField) => {
      setProgressMap((current) => {
        const previous = current[castleId] ?? EMPTY_CASTLE_PROGRESS_ENTRY;
        const next = {
          ...current,
          [castleId]: withFieldUpdate(previous, field, !previous[field]),
        };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const markProgressCollected = useCallback(
    (castleId: number, field: CastleProgressField) => {
      setProgressMap((current) => {
        const entry = current[castleId] ?? EMPTY_CASTLE_PROGRESS_ENTRY;
        if (entry[field]) {
          return current;
        }

        const next = {
          ...current,
          [castleId]: withFieldUpdate(entry, field, true),
        };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const reloadProgressMap = useCallback(async () => {
    const map = await loadProgressMap();
    setProgressMap(map);
  }, []);

  const value = useMemo(
    () => ({
      loaded,
      progressMap,
      getProgress,
      toggleProgress,
      markProgressCollected,
      reloadProgressMap,
    }),
    [getProgress, loaded, markProgressCollected, progressMap, reloadProgressMap, toggleProgress],
  );

  return (
    <CastleProgressContext.Provider value={value}>{children}</CastleProgressContext.Provider>
  );
}

export function useCastleProgress() {
  const context = useContext(CastleProgressContext);
  if (!context) {
    throw new Error('useCastleProgress must be used within CastleProgressProvider');
  }
  return context;
}
