import {
  STATION_PROGRESS_FIELDS,
  createProgressEntry,
  EMPTY_STATION_PROGRESS_ENTRY,
  sanitizeProgressEntry,
  type StationProgressEntry,
  type StationProgressField,
  type StationProgressMap,
} from '../types/stationProgress';

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
): Record<StationProgressField, number> {
  const updatedAt = { ...EMPTY_STATION_PROGRESS_ENTRY.updatedAt };

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return STATION_PROGRESS_FIELDS.reduce(
      (acc, field) => {
        acc[field] = fallbackTimestamp;
        return acc;
      },
      { ...updatedAt },
    );
  }

  const source = raw as Partial<Record<StationProgressField, unknown>>;
  for (const field of STATION_PROGRESS_FIELDS) {
    updatedAt[field] = parseTimestamp(source[field]) ?? fallbackTimestamp;
  }

  return updatedAt;
}

function normalizeProgressEntry(value: unknown, fallbackTimestamp = 0): StationProgressEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const entry = value as Record<string, unknown>;
  const hasExplicitTimestamps =
    entry.updatedAt != null || entry._t != null || entry.updated_at != null;

  const timestampSource = entry.updatedAt ?? entry._t ?? entry.updated_at;
  const entryFallback = hasExplicitTimestamps ? 0 : fallbackTimestamp;

  return sanitizeProgressEntry(
    createProgressEntry(
      {
        visited: parseProgressBoolean(entry.visited),
        magnet: parseProgressBoolean(entry.magnet),
        magnetNotSold: parseProgressBoolean(entry.magnetNotSold),
      },
      normalizeUpdatedAt(timestampSource, entryFallback),
    ),
  );
}

export function normalizeProgressMap(
  raw: unknown,
  fallbackTimestamp = 0,
): StationProgressMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const map: StationProgressMap = {};

  for (const [key, value] of Object.entries(raw)) {
    const stationId = Number(key);
    if (!Number.isFinite(stationId) || stationId <= 0) {
      continue;
    }

    const entry = normalizeProgressEntry(value, fallbackTimestamp);
    if (entry) {
      map[stationId] = entry;
    }
  }

  return map;
}

function mergeProgressEntry(
  left: StationProgressEntry,
  right: StationProgressEntry,
): StationProgressEntry {
  const merged = createProgressEntry();

  for (const field of STATION_PROGRESS_FIELDS) {
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

  return sanitizeProgressEntry(merged);
}

/** Last-write-wins merge per field using updatedAt timestamps. */
export function mergeProgressMaps(
  left: StationProgressMap,
  right: StationProgressMap,
): StationProgressMap {
  const ids = new Set([...Object.keys(left), ...Object.keys(right)].map(Number));
  const merged: StationProgressMap = {};

  for (const stationId of ids) {
    const leftEntry = left[stationId] ?? EMPTY_STATION_PROGRESS_ENTRY;
    const rightEntry = right[stationId] ?? EMPTY_STATION_PROGRESS_ENTRY;
    merged[stationId] = mergeProgressEntry(leftEntry, rightEntry);
  }

  return merged;
}

/** Patch merge: incoming keys overwrite base; other keys are preserved. */
export function mergeProgressMapsPatch(
  base: StationProgressMap,
  patch: StationProgressMap,
): StationProgressMap {
  const merged: StationProgressMap = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    const stationId = Number(key);
    if (Number.isFinite(stationId) && stationId > 0) {
      merged[stationId] = value;
    }
  }

  return merged;
}

export function serializeProgressMap(map: StationProgressMap): Record<string, unknown> {
  const serialized: Record<string, unknown> = {};

  for (const [stationId, entry] of Object.entries(map)) {
    serialized[stationId] = {
      visited: entry.visited,
      magnet: entry.magnet,
      magnetNotSold: entry.magnetNotSold,
      updatedAt: entry.updatedAt,
    };
  }

  return serialized;
}
