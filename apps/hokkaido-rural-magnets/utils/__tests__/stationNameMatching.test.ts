import { filterStationsByQuery } from '../stationNameMatching';
import { createStation } from './fixtures';

describe('filterStationsByQuery', () => {
  const stations = [
    createStation({
      id: 1,
      number: 1,
      name: '姫路城',
      nameEn: 'Himeji Station',
      location: '兵庫県姫路市',
      prefecture: '兵庫県',
    }),
    createStation({
      id: 2,
      number: 12,
      name: '松本城',
      nameEn: 'Matsumoto Station',
      location: '長野県松本市',
      prefecture: '長野県',
    }),
  ];

  it('returns empty results for blank queries', () => {
    expect(filterStationsByQuery(stations, '')).toEqual([]);
    expect(filterStationsByQuery(stations, '   ')).toEqual([]);
  });

  it('matches Japanese names ignoring separators', () => {
    const result = filterStationsByQuery(stations, '姫 路');
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('姫路城');
  });

  it('matches English names case-insensitively', () => {
    const result = filterStationsByQuery(stations, 'himeji');
    expect(result).toHaveLength(1);
    expect(result[0]?.nameEn).toBe('Himeji Station');
  });

  it('matches location and prefecture fields', () => {
    expect(filterStationsByQuery(stations, '長野')).toHaveLength(1);
    expect(filterStationsByQuery(stations, '兵庫県')).toHaveLength(1);
  });

  it('does not match station numbers', () => {
    expect(filterStationsByQuery(stations, '1')).toEqual([]);
    expect(filterStationsByQuery(stations, '12')).toEqual([]);
  });
});
