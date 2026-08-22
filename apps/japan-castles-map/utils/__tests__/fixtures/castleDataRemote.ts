import type { CastleDataManifest } from '../../../types/castleDataManifest';
import { BUNDLED_CASTLE_DATA_VERSION } from '../../castleDataSync';

export const REMOTE_MANIFEST: CastleDataManifest = {
  version: BUNDLED_CASTLE_DATA_VERSION + 1,
  updatedAt: '2026-08-09T12:00:00.000Z',
  files: {
    castles: { path: 'castles.json' },
    content: { path: 'castle-content.zh-Hant.json', locale: 'zh-Hant' },
  },
};

export const REMOTE_CASTLES = [
  {
    id: 1,
    number: 1,
    name: 'Remote Castle',
    series: 'original',
    seriesLabel: '日本100名城',
    prefecture: '北海道',
    city: '根室市',
    location: '北海道根室市',
    latitude: 43.38,
    longitude: 145.81,
  },
] as const;

export const REMOTE_CONTENT = {
  '1': {
    subtitle: 'Remote Castle',
    description: 'Remote content',
  },
};
