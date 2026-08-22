import {
  CASTLE_PROGRESS_FIELDS,
  createProgressEntry,
  EMPTY_CASTLE_PROGRESS_ENTRY,
  type CastleProgressEntry,
  type CastleProgressField,
  type CastleProgressMap,
} from '../types/castleProgress';

function parseProgressBoolean(value: unknown): boolean {
  if (value === true || value === 1) {
    return true;
  }
  if (value === false || value === 0 || value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === '') {
      return false;
    }
  }
  return Boolean(value);
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function normalizeUpdatedAt(
  raw: unknown,
  fallbackTimestamp: number,
): Record<CastleProgressField, number> {
  const updatedAt = { ...EMPTY_CASTLE_PROGRESS_ENTRY.updatedAt };

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return CASTLE_PROGRESS_FIELDS.reduce(
      (acc, field) => {
        acc[field] = fallbackTimestamp;
        return acc;
      },
      { ...updatedAt },
    );
  }

  const source = raw as Partial<Record<CastleProgressField, unknown>>;
  for (const field of CASTLE_PROGRESS_FIELDS) {
    updatedAt[field] = parseTimestamp(source[field]) ?? fallbackTimestamp;
  }

  return updatedAt;
}

function normalizeProgressEntry(value: unknown, fallbackTimestamp = 0): CastleProgressEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const entry = value as Record<string, unknown>;
  const hasExplicitTimestamps =
    entry.updatedAt != null || entry._t != null || entry.updated_at != null;

  const timestampSource = entry.updatedAt ?? entry._t ?? entry.updated_at;
  const entryFallback = hasExplicitTimestamps ? 0 : fallbackTimestamp;

  return createProgressEntry(
    {
      visited: parseProgressBoolean(entry.visited),
      meijoStamp: parseProgressBoolean(entry.meijoStamp),
      goshuin: parseProgressBoolean(entry.goshuin),
      castleCard: parseProgressBoolean(entry.castleCard),
    },
    normalizeUpdatedAt(timestampSource, entryFallback),
  );
}

export function normalizeProgressMap(
  raw: unknown,
  fallbackTimestamp = 0,
): CastleProgressMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const map: CastleProgressMap = {};

  for (const [key, value] of Object.entries(raw)) {
    const castleId = Number(key);
    if (!Number.isFinite(castleId) || castleId <= 0) {
      continue;
    }

    const entry = normalizeProgressEntry(value, fallbackTimestamp);
    if (entry) {
      map[castleId] = entry;
    }
  }

  return map;
}

function mergeProgressEntry(
  left: CastleProgressEntry,
  right: CastleProgressEntry,
): CastleProgressEntry {
  const merged = createProgressEntry();

  for (const field of CASTLE_PROGRESS_FIELDS) {
    const leftTimestamp = left.updatedAt[field];
    const rightTimestamp = right.updatedAt[field];

    if (leftTimestamp > rightTimestamp) {
      merged[field] = left[field];
      merged.updatedAt[field] = leftTimestamp;
      continue;
    }

    if (rightTimestamp > leftTimestamp) {
      merged[field] = right[field];
      merged.updatedAt[field] = rightTimestamp;
      continue;
    }

    merged[field] = right[field];
    merged.updatedAt[field] = rightTimestamp;
  }

  return merged;
}

/** Last-write-wins merge per field using updatedAt timestamps. */
export function mergeProgressMaps(
  left: CastleProgressMap,
  right: CastleProgressMap,
): CastleProgressMap {
  const ids = new Set([...Object.keys(left), ...Object.keys(right)].map(Number));
  const merged: CastleProgressMap = {};

  for (const castleId of ids) {
    const leftEntry = left[castleId] ?? EMPTY_CASTLE_PROGRESS_ENTRY;
    const rightEntry = right[castleId] ?? EMPTY_CASTLE_PROGRESS_ENTRY;
    merged[castleId] = mergeProgressEntry(leftEntry, rightEntry);
  }

  return merged;
}

/** Patch merge: incoming keys overwrite base; other keys are preserved. */
export function mergeProgressMapsPatch(
  base: CastleProgressMap,
  patch: CastleProgressMap,
): CastleProgressMap {
  const merged: CastleProgressMap = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    const castleId = Number(key);
    if (Number.isFinite(castleId) && castleId > 0) {
      merged[castleId] = value;
    }
  }

  return merged;
}

export function serializeProgressMap(map: CastleProgressMap): Record<string, unknown> {
  const serialized: Record<string, unknown> = {};

  for (const [castleId, entry] of Object.entries(map)) {
    serialized[castleId] = {
      visited: entry.visited,
      meijoStamp: entry.meijoStamp,
      goshuin: entry.goshuin,
      castleCard: entry.castleCard,
      updatedAt: entry.updatedAt,
    };
  }

  return serialized;
}
