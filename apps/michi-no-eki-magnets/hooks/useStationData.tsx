import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Station } from '../types/station';
import type { StationDataBundle } from '../types/stationDataManifest';
import { isStationDataRemoteSyncConfigured } from '../utils/stationDataConfig';
import {
  BUNDLED_STATION_DATA_VERSION,
  getBundledStationDataBundle,
  loadInitialStationDataBundle,
  syncRemoteStationDataBundle,
  type StationDataSource,
} from '../utils/stationDataSync';

type StationDataContextValue = {
  stations: readonly Station[];
  revision: number;
  version: number;
  updatedAt: string;
  source: StationDataSource;
  bundledVersion: number;
  remoteSyncConfigured: boolean;
  ready: boolean;
};

const StationDataContext = createContext<StationDataContextValue | null>(null);

export function StationDataProvider({ children }: { children: ReactNode }) {
  const bundled = useMemo(() => getBundledStationDataBundle(), []);
  const [stations, setStations] = useState<readonly Station[]>(bundled.stations);
  const [version, setVersion] = useState(bundled.version);
  const [updatedAt, setUpdatedAt] = useState(bundled.updatedAt);
  const [source, setSource] = useState<StationDataSource>('bundled');
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const remoteSyncConfigured = isStationDataRemoteSyncConfigured();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const initial = await loadInitialStationDataBundle();
      if (cancelled) {
        return;
      }

      setStations(initial.stations);
      setVersion(initial.version);
      setUpdatedAt(initial.updatedAt);
      setSource(initial.source);
      setRevision((current) => current + 1);
      setReady(true);

      const synced = await syncRemoteStationDataBundle(initial.version);
      if (cancelled || !synced || synced.version <= initial.version) {
        return;
      }

      setStations(synced.stations);
      setVersion(synced.version);
      setUpdatedAt(synced.updatedAt);
      setSource('remote');
      setRevision((current) => current + 1);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      stations,
      revision,
      version,
      updatedAt,
      source,
      bundledVersion: BUNDLED_STATION_DATA_VERSION,
      remoteSyncConfigured,
      ready,
    }),
    [stations, ready, remoteSyncConfigured, revision, source, updatedAt, version],
  );

  return <StationDataContext.Provider value={value}>{children}</StationDataContext.Provider>;
}

export function useStationData(): StationDataContextValue {
  const context = useContext(StationDataContext);
  if (!context) {
    throw new Error('useStationData must be used within StationDataProvider');
  }

  return context;
}

export function useStations(): readonly Station[] {
  return useStationData().stations;
}
