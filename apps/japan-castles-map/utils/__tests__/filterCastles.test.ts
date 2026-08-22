import { filterCastles, getAvailablePrefectures } from '../filterCastles';
import { createCastle, createProgressEntry } from './fixtures';

describe('filterCastles', () => {
  const castles = [
    createCastle({ id: 1, number: 1, name: '姫路城', prefecture: '兵庫県', series: 'original' }),
    createCastle({
      id: 2,
      number: 2,
      name: '松本城',
      prefecture: '長野県',
      series: 'original',
      latitude: 36.238,
      longitude: 137.968,
    }),
    createCastle({
      id: 3,
      number: 3,
      name: '首里城',
      prefecture: '沖縄県',
      series: 'continued',
      latitude: 26.217,
      longitude: 127.719,
    }),
  ];

  it('filters by group membership', () => {
    const result = filterCastles(castles, {
      regionId: null,
      prefecture: null,
      series: 'all',
      nameQuery: '',
      progressFilter: 'all',
      groupCastleIdSet: new Set([2, 3]),
    });

    expect(result.map((castle) => castle.id)).toEqual([2, 3]);
  });

  it('filters by series and prefecture', () => {
    const result = filterCastles(castles, {
      regionId: null,
      prefecture: '兵庫県',
      series: 'original',
      nameQuery: '',
      progressFilter: 'all',
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('姫路城');
  });

  it('filters by progress state', () => {
    const progressMap = {
      1: createProgressEntry({ visited: true }),
      2: createProgressEntry({ visited: false }),
    };

    const visited = filterCastles(castles, {
      regionId: null,
      prefecture: null,
      series: 'all',
      nameQuery: '',
      progressFilter: 'visited',
      progressMap,
    });

    expect(visited.map((castle) => castle.id)).toEqual([1]);
  });

  it('matches exact number queries', () => {
    const result = filterCastles(castles, {
      regionId: null,
      prefecture: null,
      series: 'all',
      nameQuery: '2',
      progressFilter: 'all',
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('松本城');
  });

  it('matches castle names in text search', () => {
    const result = filterCastles(castles, {
      regionId: null,
      prefecture: null,
      series: 'all',
      nameQuery: '首里',
      progressFilter: 'all',
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('首里城');
  });

  it('normalizes full-width number queries and number prefixes', () => {
    const result = filterCastles(castles, {
      regionId: null,
      prefecture: null,
      series: 'all',
      nameQuery: '＃No.２',
      progressFilter: 'all',
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('松本城');
  });

  it('filters by region and continued series', () => {
    const result = filterCastles(castles, {
      regionId: 'kyushu',
      prefecture: null,
      series: 'continued',
      nameQuery: '',
      progressFilter: 'all',
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('首里城');
  });

  it('filters by collectible progress states', () => {
    const progressMap = {
      1: createProgressEntry({ meijoStamp: true, goshuin: false, castleCard: true }),
      2: createProgressEntry({ meijoStamp: false, goshuin: true, castleCard: false }),
      3: createProgressEntry({ meijoStamp: false, goshuin: false, castleCard: false }),
    };

    expect(
      filterCastles(castles, {
        regionId: null,
        prefecture: null,
        series: 'all',
        nameQuery: '',
        progressFilter: 'has-meijo-stamp',
        progressMap,
      }).map((castle) => castle.id),
    ).toEqual([1]);

    expect(
      filterCastles(castles, {
        regionId: null,
        prefecture: null,
        series: 'all',
        nameQuery: '',
        progressFilter: 'has-castle-card',
        progressMap,
      }).map((castle) => castle.id),
    ).toEqual([1]);
  });
});

describe('getAvailablePrefectures', () => {
  const castles = [
    createCastle({ prefecture: '兵庫県', series: 'original' }),
    createCastle({ id: 2, prefecture: '長野県', series: 'original' }),
    createCastle({ id: 3, prefecture: '沖縄県', series: 'continued' }),
  ];

  it('returns sorted prefectures for a series', () => {
    const prefectures = getAvailablePrefectures(castles, null, 'original');
    expect(prefectures).toHaveLength(2);
    expect(prefectures).toEqual(expect.arrayContaining(['兵庫県', '長野県']));
  });

  it('returns all prefectures when series is all', () => {
    const prefectures = getAvailablePrefectures(castles, null, 'all');
    expect(prefectures).toHaveLength(3);
    expect(prefectures).toEqual(expect.arrayContaining(['兵庫県', '沖縄県', '長野県']));
  });

  it('limits prefectures to a selected region', () => {
    const prefectures = getAvailablePrefectures(castles, 'kinki', 'all');
    expect(prefectures).toEqual(['兵庫県']);
  });
});
