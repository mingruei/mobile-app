import type { Castle } from '../types/castle';
import {
  CASTLE_PROGRESS_FIELDS,
  EMPTY_CASTLE_PROGRESS_ENTRY,
  type CastleProgressEntry,
  type CastleProgressMap,
} from '../types/castleProgress';

export type ProgressCounts = {
  visited: number;
  meijoStamp: number;
  goshuin: number;
  castleCard: number;
  total: number;
};

export type ProgressStats = {
  original: ProgressCounts;
  continued: ProgressCounts;
  total: ProgressCounts;
};

const PROGRESS_FIELDS = CASTLE_PROGRESS_FIELDS;

function createCounts(total: number): ProgressCounts {
  return {
    visited: 0,
    meijoStamp: 0,
    goshuin: 0,
    castleCard: 0,
    total,
  };
}

function addProgress(counts: ProgressCounts, progress: CastleProgressEntry) {
  for (const field of PROGRESS_FIELDS) {
    if (progress[field]) {
      counts[field] += 1;
    }
  }
}

export function computeProgressStats(
  castles: readonly Castle[],
  progressMap: CastleProgressMap,
): ProgressStats {
  const original = createCounts(0);
  const continued = createCounts(0);

  for (const castle of castles) {
    const progress = progressMap[castle.id] ?? EMPTY_CASTLE_PROGRESS_ENTRY;
    if (castle.series === 'original') {
      original.total += 1;
      addProgress(original, progress);
    } else {
      continued.total += 1;
      addProgress(continued, progress);
    }
  }

  return {
    original,
    continued,
    total: {
      visited: original.visited + continued.visited,
      meijoStamp: original.meijoStamp + continued.meijoStamp,
      goshuin: original.goshuin + continued.goshuin,
      castleCard: original.castleCard + continued.castleCard,
      total: original.total + continued.total,
    },
  };
}
