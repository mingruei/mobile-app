export type StationProgress = {
  visited: boolean;
  magnet: boolean;
  magnetNotSold: boolean;
};

export type StationProgressField = keyof StationProgress;

export const STATION_PROGRESS_FIELDS: StationProgressField[] = [
  'visited',
  'magnet',
  'magnetNotSold',
];

export type StationProgressEntry = StationProgress & {
  updatedAt: Record<StationProgressField, number>;
};

export type StationProgressMap = Record<number, StationProgressEntry>;

export const EMPTY_STATION_PROGRESS_ENTRY: StationProgressEntry = {
  visited: false,
  magnet: false,
  magnetNotSold: false,
  updatedAt: {
    visited: 0,
    magnet: 0,
    magnetNotSold: 0,
  },
};

/** @deprecated Use EMPTY_STATION_PROGRESS_ENTRY */
export const EMPTY_STATION_PROGRESS: StationProgress = {
  visited: false,
  magnet: false,
  magnetNotSold: false,
};

export function createProgressEntry(
  progress: Partial<StationProgress> = {},
  updatedAt: Partial<Record<StationProgressField, number>> = {},
): StationProgressEntry {
  return {
    visited: progress.visited ?? false,
    magnet: progress.magnet ?? false,
    magnetNotSold: progress.magnetNotSold ?? false,
    updatedAt: {
      visited: updatedAt.visited ?? 0,
      magnet: updatedAt.magnet ?? 0,
      magnetNotSold: updatedAt.magnetNotSold ?? 0,
    },
  };
}

/** magnetNotSold and magnet are mutually exclusive. */
export function sanitizeProgressEntry(entry: StationProgressEntry): StationProgressEntry {
  if (!entry.magnetNotSold || !entry.magnet) {
    return entry;
  }

  return withFieldUpdate(entry, 'magnet', false);
}

export function withFieldUpdate(
  entry: StationProgressEntry,
  field: StationProgressField,
  value: boolean,
  updatedAt = Date.now(),
): StationProgressEntry {
  return {
    ...entry,
    [field]: value,
    updatedAt: {
      ...entry.updatedAt,
      [field]: updatedAt,
    },
  };
}
