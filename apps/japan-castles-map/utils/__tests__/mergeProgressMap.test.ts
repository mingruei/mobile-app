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
        meijoStamp: 0,
        goshuin: false,
        castleCard: false,
      },
      invalid: { visited: true },
      '-1': { visited: true },
    });

    expect(map[1]).toMatchObject({
      visited: true,
      meijoStamp: false,
      goshuin: false,
      castleCard: false,
    });
    expect(map[Number('invalid')]).toBeUndefined();
    expect(map[-1]).toBeUndefined();
  });

  it('merges by latest updatedAt per field', () => {
    const left = {
      1: createProgressEntry(
        { visited: true, goshuin: false },
        { visited: 100, goshuin: 100, meijoStamp: 0, castleCard: 0 },
      ),
    };
    const right = {
      1: createProgressEntry(
        { visited: false, goshuin: true },
        { visited: 50, goshuin: 200, meijoStamp: 0, castleCard: 0 },
      ),
    };

    const merged = mergeProgressMaps(left, right);
    expect(merged[1]?.visited).toBe(true);
    expect(merged[1]?.goshuin).toBe(true);
  });

  it('patches only provided castle ids', () => {
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

  it('serializes progress maps for export', () => {
    const map = {
      1: createProgressEntry({ visited: true }, { visited: 10, meijoStamp: 0, goshuin: 0, castleCard: 0 }),
    };

    expect(serializeProgressMap(map)).toEqual({
      '1': {
        visited: true,
        meijoStamp: false,
        goshuin: false,
        castleCard: false,
        updatedAt: map[1]?.updatedAt,
      },
    });
  });

  it('returns empty maps for invalid raw values', () => {
    expect(normalizeProgressMap(null)).toEqual({});
    expect(normalizeProgressMap([])).toEqual({});
  });

  it('parses legacy timestamp fields and string booleans', () => {
    const map = normalizeProgressMap({
      1: {
        visited: '1',
        meijoStamp: 'false',
        goshuin: 1,
        castleCard: 0,
        updated_at: { visited: '2024-01-01T00:00:00.000Z' },
      },
    });

    expect(map[1]?.visited).toBe(true);
    expect(map[1]?.meijoStamp).toBe(false);
    expect(map[1]?.goshuin).toBe(true);
    expect(map[1]?.updatedAt.visited).toBe(Date.parse('2024-01-01T00:00:00.000Z'));
  });

  it('prefers right-hand timestamps when equal', () => {
    const left = {
      1: createProgressEntry(
        { visited: false },
        { visited: 100, meijoStamp: 0, goshuin: 0, castleCard: 0 },
      ),
    };
    const right = {
      1: createProgressEntry(
        { visited: true },
        { visited: 100, meijoStamp: 0, goshuin: 0, castleCard: 0 },
      ),
    };

    expect(mergeProgressMaps(left, right)[1]?.visited).toBe(true);
  });
});
