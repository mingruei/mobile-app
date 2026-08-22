import { filterStations, getAvailablePrefectures } from '../filterStations';
import { createStation, createProgressEntry } from './fixtures';

describe('filterStations', () => {
  const stations = [
    createStation({
      id: 1,
      number: 1,
      name: '道の駅 美瑛',
      prefecture: '北海道',
      services: ['shop', 'restaurant'],
    }),
    createStation({
      id: 2,
      number: 2,
      name: '道の駅 木曽',
      prefecture: '長野県',
      latitude: 36.238,
      longitude: 137.968,
      services: ['hotSpring', 'wifi'],
    }),
    createStation({
      id: 3,
      number: 3,
      name: '道の駅 許田',
      prefecture: '沖縄県',
      latitude: 26.217,
      longitude: 127.719,
      services: ['shop', 'wifi', 'evCharging'],
    }),
  ];

  it('filters by group membership', () => {
    const result = filterStations(stations, {
      regionId: null,
      prefecture: null,
      selectedServices: [],
      nameQuery: '',
      progressFilter: 'all',
      groupStationIdSet: new Set([2, 3]),
    });

    expect(result.map((station) => station.id)).toEqual([2, 3]);
  });

  it('filters by prefecture', () => {
    const result = filterStations(stations, {
      regionId: 'hokkaido',
      prefecture: '道北',
      selectedServices: [],
      nameQuery: '',
      progressFilter: 'all',
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('道の駅 美瑛');
  });

  it('filters Hokkaido stations by sub-area', () => {
    const hokkaidoStations = [
      createStation({
        id: 10,
        number: 10,
        name: '道の駅 三笠',
        prefecture: '北海道',
        city: '三笠市',
      }),
      createStation({
        id: 11,
        number: 11,
        name: '道の駅 函館',
        prefecture: '北海道',
        city: '函館市',
      }),
    ];

    const result = filterStations(hokkaidoStations, {
      regionId: 'hokkaido',
      prefecture: '道央',
      selectedServices: [],
      nameQuery: '',
      progressFilter: 'all',
    });

    expect(result.map((station) => station.id)).toEqual([10]);
  });

  it('filters by progress state', () => {
    const progressMap = {
      1: createProgressEntry({ visited: true }),
      2: createProgressEntry({ visited: false }),
    };

    const visited = filterStations(stations, {
      regionId: null,
      prefecture: null,
      selectedServices: [],
      nameQuery: '',
      progressFilter: 'visited',
      progressMap,
    });

    expect(visited.map((station) => station.id)).toEqual([1]);
  });

  it('filters by selected services with AND matching', () => {
    const result = filterStations(stations, {
      regionId: null,
      prefecture: null,
      selectedServices: ['shop', 'wifi'],
      nameQuery: '',
      progressFilter: 'all',
    });

    expect(result.map((station) => station.id)).toEqual([3]);
  });

  it('matches station names in text search', () => {
    const result = filterStations(stations, {
      regionId: null,
      prefecture: null,
      selectedServices: [],
      nameQuery: '許田',
      progressFilter: 'all',
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('道の駅 許田');
  });

  it('matches station addresses in text search', () => {
    const result = filterStations(
      [
        createStation({
          id: 1,
          name: '道の駅 三笠',
          location: '北海道三笠市岡山1056-1',
        }),
        createStation({
          id: 2,
          name: '道の駅 木曽',
          location: '長野県木曽郡木曽町',
        }),
      ],
      {
        regionId: null,
        prefecture: null,
        selectedServices: [],
        nameQuery: '岡山1056',
        progressFilter: 'all',
      },
    );

    expect(result.map((station) => station.id)).toEqual([1]);
  });

  it('combines text search with region filters', () => {
    const result = filterStations(stations, {
      regionId: 'kyushu',
      prefecture: null,
      selectedServices: [],
      nameQuery: '許田',
      progressFilter: 'all',
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('道の駅 許田');
  });

  it('matches English station names case-insensitively', () => {
    const result = filterStations(
      [
        createStation({
          id: 1,
          name: '道の駅 美瑛',
          nameEn: 'Michi-no-Eki Biei',
        }),
        createStation({
          id: 2,
          name: '道の駅 木曽',
          nameEn: 'Michi-no-Eki Kiso',
        }),
      ],
      {
        regionId: null,
        prefecture: null,
        selectedServices: [],
        nameQuery: 'MICHI-NO-EKI BIEI',
        progressFilter: 'all',
      },
    );

    expect(result.map((station) => station.id)).toEqual([1]);
  });

  it('returns no matches when text search and region filters disagree', () => {
    const result = filterStations(stations, {
      regionId: 'hokkaido',
      prefecture: null,
      selectedServices: [],
      nameQuery: '許田',
      progressFilter: 'all',
    });

    expect(result).toEqual([]);
  });

  it('does not treat numeric-only queries as station numbers on browse filters', () => {
    const result = filterStations(stations, {
      regionId: null,
      prefecture: null,
      selectedServices: [],
      nameQuery: '2',
      progressFilter: 'all',
    });

    expect(result).toEqual([]);
  });

  it('filters by region', () => {
    const result = filterStations(stations, {
      regionId: 'kyushu',
      prefecture: null,
      selectedServices: [],
      nameQuery: '',
      progressFilter: 'all',
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('道の駅 許田');
  });

  it('filters by magnet progress state', () => {
    const progressMap = {
      1: createProgressEntry({ magnet: true }),
      2: createProgressEntry({ magnet: false }),
      3: createProgressEntry({ magnet: false }),
    };

    expect(
      filterStations(stations, {
        regionId: null,
        prefecture: null,
        selectedServices: [],
        nameQuery: '',
        progressFilter: 'has-magnet',
        progressMap,
      }).map((station) => station.id),
    ).toEqual([1]);
  });
});

describe('getAvailablePrefectures', () => {
  const stations = [
    createStation({ prefecture: '北海道' }),
    createStation({ id: 2, prefecture: '長野県' }),
    createStation({ id: 3, prefecture: '沖縄県' }),
  ];

  it('returns sorted prefectures', () => {
    const prefectures = getAvailablePrefectures(stations, null);
    expect(prefectures).toHaveLength(3);
    expect(prefectures).toEqual(expect.arrayContaining(['北海道', '長野県', '沖縄県']));
  });

  it('limits prefectures to a selected region', () => {
    const prefectures = getAvailablePrefectures(stations, 'hokkaido');
    expect(prefectures).toEqual(['道北']);
  });

  it('returns Hokkaido sub-areas when filtering by Hokkaido region', () => {
    const hokkaidoStations = [
      createStation({ prefecture: '北海道', city: '三笠市' }),
      createStation({ id: 2, prefecture: '北海道', city: '函館市' }),
      createStation({ id: 3, prefecture: '北海道', city: '旭川市' }),
      createStation({ id: 4, prefecture: '北海道', city: '釧路市' }),
    ];

    expect(getAvailablePrefectures(hokkaidoStations, 'hokkaido')).toEqual([
      '道南',
      '道央',
      '道東',
      '道北',
    ]);
  });
});
