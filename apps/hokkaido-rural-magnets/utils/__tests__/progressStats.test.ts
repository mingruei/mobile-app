import { computeProgressStats } from '../progressStats';
import { createStation, createProgressEntry } from './fixtures';

describe('computeProgressStats', () => {
  const stations = [
    createStation({ id: 1 }),
    createStation({ id: 2 }),
    createStation({ id: 3 }),
  ];

  it('counts totals and progress fields', () => {
    const progressMap = {
      1: createProgressEntry({ visited: true, magnet: true }),
      2: createProgressEntry({ visited: false, magnet: false }),
      3: createProgressEntry({ visited: true, magnet: false }),
    };

    const stats = computeProgressStats(stations, progressMap);

    expect(stats.total).toEqual({
      visited: 2,
      magnet: 1,
      total: 3,
    });
  });

  it('treats missing progress entries as empty', () => {
    const stats = computeProgressStats(stations, {});

    expect(stats.total.total).toBe(3);
    expect(stats.total.visited).toBe(0);
  });
});
