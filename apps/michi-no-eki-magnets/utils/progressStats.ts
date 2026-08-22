import type { Station } from '../types/station';
import {
  EMPTY_STATION_PROGRESS_ENTRY,
  type StationProgressEntry,
  type StationProgressMap,
} from '../types/stationProgress';

export type ProgressCounts = {
  visited: number;
  magnet: number;
  total: number;
};

export type ProgressStats = {
  total: ProgressCounts;
};

type StatsProgressField = Exclude<keyof ProgressCounts, 'total'>;

const STATS_PROGRESS_FIELDS: StatsProgressField[] = ['visited', 'magnet'];

function createCounts(total: number): ProgressCounts {
  return {
    visited: 0,
    magnet: 0,
    total,
  };
}

function addProgress(counts: ProgressCounts, progress: StationProgressEntry) {
  for (const field of STATS_PROGRESS_FIELDS) {
    if (progress[field]) {
      counts[field] += 1;
    }
  }
}

export function computeProgressStats(
  stations: readonly Station[],
  progressMap: StationProgressMap,
): ProgressStats {
  const total = createCounts(stations.length);

  for (const station of stations) {
    const progress = progressMap[station.id] ?? EMPTY_STATION_PROGRESS_ENTRY;
    addProgress(total, progress);
  }

  return { total };
}
