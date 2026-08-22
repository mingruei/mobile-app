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
  EMPTY_STATION_PROGRESS_ENTRY,
  sanitizeProgressEntry,
  withFieldUpdate,
  type StationProgressEntry,
  type StationProgressField,
  type StationProgressMap,
} from '../types/stationProgress';
import { loadProgressMap, saveProgressMap } from '../utils/stationProgressStorage';

type StationProgressContextValue = {
  loaded: boolean;
  progressMap: StationProgressMap;
  getProgress: (stationId: number) => StationProgressEntry;
  toggleProgress: (stationId: number, field: StationProgressField) => void;
  markProgressCollected: (stationId: number, field: StationProgressField) => void;
  reloadProgressMap: () => Promise<void>;
};

const StationProgressContext = createContext<StationProgressContextValue | null>(null);

export function StationProgressProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [progressMap, setProgressMap] = useState<StationProgressMap>({});

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

  const persist = useCallback((nextMap: StationProgressMap) => {
    void saveProgressMap(nextMap).catch(() => undefined);
  }, []);

  const getProgress = useCallback(
    (stationId: number) => progressMap[stationId] ?? EMPTY_STATION_PROGRESS_ENTRY,
    [progressMap],
  );

  const toggleProgress = useCallback(
    (stationId: number, field: StationProgressField) => {
      setProgressMap((current) => {
        const previous = current[stationId] ?? EMPTY_STATION_PROGRESS_ENTRY;

        if (field === 'magnet' && previous.magnetNotSold) {
          return current;
        }

        let nextEntry = withFieldUpdate(previous, field, !previous[field]);

        if (field === 'magnetNotSold' && nextEntry.magnetNotSold) {
          nextEntry = withFieldUpdate(nextEntry, 'magnet', false);
        }

        if (field === 'magnet' && nextEntry.magnet) {
          nextEntry = withFieldUpdate(nextEntry, 'magnetNotSold', false);
        }

        nextEntry = sanitizeProgressEntry(nextEntry);

        const next = {
          ...current,
          [stationId]: nextEntry,
        };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const markProgressCollected = useCallback(
    (stationId: number, field: StationProgressField) => {
      setProgressMap((current) => {
        const entry = current[stationId] ?? EMPTY_STATION_PROGRESS_ENTRY;
        if (entry[field]) {
          return current;
        }

        if (field === 'magnet' && entry.magnetNotSold) {
          return current;
        }

        let nextEntry = withFieldUpdate(entry, field, true);
        if (field === 'magnet') {
          nextEntry = withFieldUpdate(nextEntry, 'magnetNotSold', false);
        }
        nextEntry = sanitizeProgressEntry(nextEntry);

        const next = {
          ...current,
          [stationId]: nextEntry,
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
    <StationProgressContext.Provider value={value}>{children}</StationProgressContext.Provider>
  );
}

export function useStationProgress() {
  const context = useContext(StationProgressContext);
  if (!context) {
    throw new Error('useStationProgress must be used within StationProgressProvider');
  }
  return context;
}
