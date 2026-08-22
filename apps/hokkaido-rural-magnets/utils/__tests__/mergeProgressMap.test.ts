import {
  mergeProgressMaps,
  mergeProgressMapsPatch,
  normalizeProgressMap,
  serializeProgressMap,
} from '../mergeProgressMap';
import { createProgressEntry } from './fixtures';

describe('mergeProgressMap', () => {
  it('normalizes raw progress maps', () => {
    const map = normalizeProgressMap({
      '1': {
        visited: 'true',
        magnet: 0,
      },
      invalid: { visited: true },
      '-1': { visited: true },
    });

    expect(map[1]).toMatchObject({
      visited: true,
      magnet: false,
    });
    expect(map[Number('invalid')]).toBeUndefined();
    expect(map[-1]).toBeUndefined();
  });

  it('merges by latest updatedAt per field', () => {
    const left = {
      1: createProgressEntry(
        { visited: true, magnet: false },
        { visited: 100, magnet: 100 },
      ),
    };
    const right = {
      1: createProgressEntry(
        { visited: false, magnet: true },
        { visited: 50, magnet: 200 },
      ),
    };

    const merged = mergeProgressMaps(left, right);
    expect(merged[1]?.visited).toBe(true);
    expect(merged[1]?.magnet).toBe(true);
  });

  it('patches only provided station ids', () => {
    const base = {
      1: createProgressEntry({ visited: true }),
      2: createProgressEntry({ visited: false }),
    };
    const patch = {
      2: createProgressEntry({ visited: true }),
    };

    const merged = mergeProgressMapsPatch(base, patch);
    expect(merged[1]?.visited).toBe(true);
    expect(merged[2]?.visited).toBe(true);
  });

  it('serializes progress maps for backup', () => {
    const map = {
      1: createProgressEntry({ visited: true, magnet: true }),
    };

    expect(serializeProgressMap(map)).toEqual({
      '1': {
        visited: true,
        magnet: true,
        magnetNotSold: false,
        updatedAt: map[1]?.updatedAt,
      },
    });
  });

  it('clears magnet when both magnet and magnetNotSold are true after normalize', () => {
    const map = normalizeProgressMap({
      '1': {
        visited: false,
        magnet: true,
        magnetNotSold: true,
      },
    });

    expect(map[1]?.magnet).toBe(false);
    expect(map[1]?.magnetNotSold).toBe(true);
  });
});
