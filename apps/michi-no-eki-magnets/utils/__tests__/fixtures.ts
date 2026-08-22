import type { Station } from '../../types/station';
import { createProgressEntry } from '../../types/stationProgress';

export function createStation(overrides: Partial<Station> = {}): Station {
  return {
    id: 1,
    number: 1,
    name: '道の駅 美瑛',
    nameEn: 'Michi-no-Eki Biei',
    prefecture: '北海道',
    city: '上川郡美瑛町',
    location: '北海道美瑛町',
    latitude: 43.5889,
    longitude: 142.4678,
    services: [],
    ...overrides,
  };
}

export { createProgressEntry };
