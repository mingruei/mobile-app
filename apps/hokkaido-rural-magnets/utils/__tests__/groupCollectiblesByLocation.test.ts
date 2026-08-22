import { groupCollectiblesByRegionAndPrefecture } from '../groupCollectiblesByLocation';
import { createStation } from './fixtures';
import type { StationCollectible } from '../../types/stationCollectible';

function createCollectible(
  overrides: Partial<StationCollectible> & Pick<StationCollectible, 'stationId'>,
): StationCollectible {
  return {
    id: `${overrides.stationId}:magnet:photo.jpg`,
    stationId: overrides.stationId,
    kind: 'magnet',
    filename: 'photo.jpg',
    mimeType: 'image/jpeg',
    createdAt: overrides.createdAt ?? 1,
    ...overrides,
  };
}

describe('groupCollectiblesByRegionAndPrefecture', () => {
  it('groups collectibles by region and prefecture in display order', () => {
    const stations = [
      createStation({ id: 1, number: 1, prefecture: '沖縄県', city: '名護市' }),
      createStation({
        id: 2,
        number: 2,
        name: '道の駅 三笠',
        prefecture: '北海道',
        city: '三笠市',
      }),
      createStation({
        id: 3,
        number: 3,
        name: '道の駅 函館',
        prefecture: '北海道',
        city: '函館市',
      }),
    ];
    const stationById = new Map(stations.map((station) => [station.id, station]));
    const items = [
      createCollectible({ stationId: 1, id: '1:magnet:a.jpg' }),
      createCollectible({ stationId: 2, id: '2:magnet:b.jpg' }),
      createCollectible({ stationId: 3, id: '3:magnet:c.jpg' }),
    ];

    expect(groupCollectiblesByRegionAndPrefecture(items, stationById)).toEqual([
      {
        regionId: 'hokkaido',
        prefectureGroups: [
          { prefectureKey: '道南', items: [items[2]!] },
          { prefectureKey: '道央', items: [items[1]!] },
        ],
      },
      {
        regionId: 'kyushu',
        prefectureGroups: [{ prefectureKey: '沖縄県', items: [items[0]!] }],
      },
    ]);
  });
});
