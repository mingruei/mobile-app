import { filterCastlesByQuery } from '../castleNameMatching';
import { createCastle } from './fixtures';

describe('filterCastlesByQuery', () => {
  const castles = [
    createCastle({
      id: 1,
      number: 1,
      name: '姫路城',
      nameEn: 'Himeji Castle',
      location: '兵庫県姫路市',
      prefecture: '兵庫県',
    }),
    createCastle({
      id: 2,
      number: 12,
      name: '松本城',
      nameEn: 'Matsumoto Castle',
      location: '長野県松本市',
      prefecture: '長野県',
    }),
  ];

  it('returns empty results for blank queries', () => {
    expect(filterCastlesByQuery(castles, '')).toEqual([]);
    expect(filterCastlesByQuery(castles, '   ')).toEqual([]);
  });

  it('matches Japanese names ignoring separators', () => {
    const result = filterCastlesByQuery(castles, '姫 路');
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('姫路城');
  });

  it('matches English names case-insensitively', () => {
    const result = filterCastlesByQuery(castles, 'himeji');
    expect(result).toHaveLength(1);
    expect(result[0]?.nameEn).toBe('Himeji Castle');
  });

  it('matches location and prefecture fields', () => {
    expect(filterCastlesByQuery(castles, '長野')).toHaveLength(1);
    expect(filterCastlesByQuery(castles, '兵庫県')).toHaveLength(1);
  });

  it('matches exact and prefix castle numbers', () => {
    expect(filterCastlesByQuery(castles, '1').map((castle) => castle.number)).toEqual([1, 12]);
    expect(filterCastlesByQuery(castles, '12')).toHaveLength(1);
    expect(filterCastlesByQuery(castles, '99')).toHaveLength(0);
  });
});
