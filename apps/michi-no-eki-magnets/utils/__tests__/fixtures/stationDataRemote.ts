import type { StationDataManifest } from '../../../types/stationDataManifest';
import { BUNDLED_STATION_DATA_VERSION } from '../../stationDataSync';

export const REMOTE_MANIFEST: StationDataManifest = {
  version: BUNDLED_STATION_DATA_VERSION + 1,
  updatedAt: '2026-08-09T12:00:00.000Z',
  files: {
    stations: { path: 'stations.json' },
  },
};

export const REMOTE_STATIONS = [
  {
    id: 1,
    number: 1,
    name: 'Remote Station',
    prefecture: '北海道',
    city: '美瑛町',
    location: '北海道美瑛町',
    latitude: 43.38,
    longitude: 142.46,
  },
] as const;
