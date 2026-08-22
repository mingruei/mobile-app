export type CastleProgress = {
  visited: boolean;
  meijoStamp: boolean;
  goshuin: boolean;
  castleCard: boolean;
};

export type CastleProgressField = keyof CastleProgress;

export const CASTLE_PROGRESS_FIELDS: CastleProgressField[] = [
  'visited',
  'meijoStamp',
  'goshuin',
  'castleCard',
];

export type CastleProgressEntry = CastleProgress & {
  updatedAt: Record<CastleProgressField, number>;
};

export type CastleProgressMap = Record<number, CastleProgressEntry>;

export const EMPTY_CASTLE_PROGRESS_ENTRY: CastleProgressEntry = {
  visited: false,
  meijoStamp: false,
  goshuin: false,
  castleCard: false,
  updatedAt: {
    visited: 0,
    meijoStamp: 0,
    goshuin: 0,
    castleCard: 0,
  },
};

/** @deprecated Use EMPTY_CASTLE_PROGRESS_ENTRY */
export const EMPTY_CASTLE_PROGRESS: CastleProgress = {
  visited: false,
  meijoStamp: false,
  goshuin: false,
  castleCard: false,
};

export function createProgressEntry(
  progress: Partial<CastleProgress> = {},
  updatedAt: Partial<Record<CastleProgressField, number>> = {},
): CastleProgressEntry {
  return {
    visited: progress.visited ?? false,
    meijoStamp: progress.meijoStamp ?? false,
    goshuin: progress.goshuin ?? false,
    castleCard: progress.castleCard ?? false,
    updatedAt: {
      visited: updatedAt.visited ?? 0,
      meijoStamp: updatedAt.meijoStamp ?? 0,
      goshuin: updatedAt.goshuin ?? 0,
      castleCard: updatedAt.castleCard ?? 0,
    },
  };
}

export function withFieldUpdate(
  entry: CastleProgressEntry,
  field: CastleProgressField,
  value: boolean,
  updatedAt = Date.now(),
): CastleProgressEntry {
  return {
    ...entry,
    [field]: value,
    updatedAt: {
      ...entry.updatedAt,
      [field]: updatedAt,
    },
  };
}
