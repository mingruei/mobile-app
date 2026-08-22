import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { Station } from '../types/station';
import { getBundledStationDataBundle } from '../utils/stationDataSync';

type StationDataContextValue = {
  stations: readonly Station[];
  revision: number;
  ready: boolean;
};

const StationDataContext = createContext<StationDataContextValue | null>(null);

export function StationDataProvider({ children }: { children: ReactNode }) {
  const bundled = useMemo(() => getBundledStationDataBundle(), []);
  const value = useMemo(
    () => ({
      stations: bundled.stations,
      revision: 0,
      ready: true,
    }),
    [bundled.stations],
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
