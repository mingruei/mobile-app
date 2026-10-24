import { useEffect, useState } from 'react';

import type { Station } from '../types/station';
import {
  getCachedStationPhotoUri,
  resolveStationPhotoUri,
} from '../utils/stationPhotoCache';

export type StationPhotoState = {
  uri: string | null;
  resolved: boolean;
};

export function useStationPhotoUri(station: Station, dataVersion: number): StationPhotoState {
  const [state, setState] = useState<StationPhotoState>(() => {
    if (!station.imageUrl) {
      return { uri: null, resolved: true };
    }

    const cached = getCachedStationPhotoUri(station.id, dataVersion);
    return {
      uri: cached,
      resolved: cached != null,
    };
  });

  useEffect(() => {
    if (!station.imageUrl) {
      setState({ uri: null, resolved: true });
      return;
    }

    let cancelled = false;
    const cached = getCachedStationPhotoUri(station.id, dataVersion);

    setState({
      uri: cached,
      resolved: cached != null,
    });

    void resolveStationPhotoUri({
      stationId: station.id,
      imageUrl: station.imageUrl,
      dataVersion,
    }).then((uri) => {
      if (cancelled) {
        return;
      }

      setState({ uri, resolved: true });
    });

    return () => {
      cancelled = true;
    };
  }, [station.id, station.imageUrl, dataVersion]);

  return state;
}
