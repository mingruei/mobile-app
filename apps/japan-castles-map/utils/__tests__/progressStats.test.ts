import { computeProgressStats } from '../progressStats';
import { createCastle, createProgressEntry } from './fixtures';

describe('computeProgressStats', () => {
  const castles = [
    createCastle({ id: 1, series: 'original' }),
    createCastle({ id: 2, series: 'original' }),
    createCastle({ id: 3, series: 'continued' }),
  ];

  it('counts totals and progress fields per series', () => {
    const progressMap = {
      1: createProgressEntry({ visited: true, meijoStamp: true, goshuin: false, castleCard: true }),
      2: createProgressEntry({ visited: false, meijoStamp: false, goshuin: true, castleCard: false }),
      3: createProgressEntry({ visited: true, meijoStamp: false, goshuin: true, castleCard: false }),
    };

    const stats = computeProgressStats(castles, progressMap);

    expect(stats.original).toEqual({
      visited: 1,
      meijoStamp: 1,
      goshuin: 1,
      castleCard: 1,
      total: 2,
    });
    expect(stats.continued).toEqual({
      visited: 1,
      meijoStamp: 0,
      goshuin: 1,
      castleCard: 0,
      total: 1,
    });
    expect(stats.total).toEqual({
      visited: 2,
      meijoStamp: 1,
      goshuin: 2,
      castleCard: 1,
      total: 3,
    });
  });

  it('treats missing progress entries as empty', () => {
    const stats = computeProgressStats(castles, {});

    expect(stats.original.total).toBe(2);
    expect(stats.continued.total).toBe(1);
    expect(stats.total.visited).toBe(0);
  });
});
