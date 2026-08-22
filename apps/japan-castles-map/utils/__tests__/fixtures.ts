import type { Castle } from '../../types/castle';
import { createProgressEntry } from '../../types/castleProgress';

export function createCastle(overrides: Partial<Castle> = {}): Castle {
  return {
    id: 1,
    number: 1,
    name: '姫路城',
    nameEn: 'Himeji Castle',
    series: 'original',
    seriesLabel: '日本100名城',
    prefecture: '兵庫県',
    city: '姫路市',
    location: '兵庫県姫路市',
    latitude: 34.8394,
    longitude: 134.6939,
    ...overrides,
  };
}

export { createProgressEntry };
