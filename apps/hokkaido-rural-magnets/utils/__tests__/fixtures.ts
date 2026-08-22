import type { Station } from '../../types/station';
import { createProgressEntry } from '../../types/stationProgress';

export function createStation(overrides: Partial<Station> = {}): Station {
  return {
    id: 1,
    number: 1,
    name: '美瑛町',
    nameEn: 'Biei',
    prefecture: '北海道',
    city: '美瑛町',
    location: '北海道美瑛町',
    latitude: 43.5889,
    longitude: 142.4678,
    services: [],
    ...overrides,
  };
}

export { createProgressEntry };
