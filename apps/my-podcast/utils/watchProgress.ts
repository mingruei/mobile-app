import type { LibraryData } from '../types/podcast';
import { findEpisode } from './library';

export type WatchProgressReport = {
  episodeId: string;
  positionMillis: number;
  durationMillis: number | null;
  completed: boolean;
};

export function parseWatchProgress(value: unknown): WatchProgressReport | null {
  if (value === null || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.episodeId !== 'string' || record.episodeId.length === 0) return null;
  if (typeof record.positionMillis !== 'number' || !Number.isFinite(record.positionMillis)) return null;
  const duration =
    typeof record.durationMillis === 'number' &&
    Number.isFinite(record.durationMillis) &&
    record.durationMillis > 0
      ? Math.floor(record.durationMillis)
      : null;
  return {
    episodeId: record.episodeId,
    positionMillis: Math.max(0, Math.floor(record.positionMillis)),
    durationMillis: duration,
    completed: record.completed === true || record.completed === 1,
  };
}

export function watchSavedId(value: unknown): string | null {
  if (value === null || typeof value !== 'object') return null;
  const record = value as { watchSaved?: unknown; bytes?: unknown };
  const saved = record.watchSaved;
  if (typeof saved !== 'string' || saved.length === 0) return null;
  // Watch must report a positive byte count; ignore stale/false acks.
  if (typeof record.bytes === 'number' && Number.isFinite(record.bytes) && record.bytes <= 0) {
    return null;
  }
  return saved;
}

export type WatchTransferProgress = {
  episodeId: string;
  written: number;
  expected: number | null;
};

export function parseWatchTransferProgress(value: unknown): WatchTransferProgress | null {
  if (value === null || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (record.watchTransferProgress !== true && record.watchTransferProgress !== 1) return null;
  if (typeof record.episodeId !== 'string' || record.episodeId.length === 0) return null;
  const writtenRaw = record.written;
  const written =
    typeof writtenRaw === 'number' && Number.isFinite(writtenRaw)
      ? Math.max(0, Math.floor(writtenRaw))
      : 0;
  const expectedRaw = record.bytes ?? record.expected;
  const expected =
    typeof expectedRaw === 'number' && Number.isFinite(expectedRaw) && expectedRaw > 0
      ? Math.floor(expectedRaw)
      : null;
  return { episodeId: record.episodeId, written, expected };
}

export function watchFailure(
  value: unknown,
): { code: 'watch-full' | 'watch-size' | 'watch-transfer' | 'watch-network'; episodeId: string | null } | null {
  if (value === null || typeof value !== 'object') return null;
  const error = (value as { error?: unknown }).error;
  if (
    error !== 'watch-full' &&
    error !== 'watch-size' &&
    error !== 'watch-transfer' &&
    error !== 'watch-network'
  ) {
    return null;
  }
  const episodeId = (value as { episodeId?: unknown }).episodeId;
  return {
    code: error,
    episodeId: typeof episodeId === 'string' && episodeId.length > 0 ? episodeId : null,
  };
}

export function watchEventMessage(value: unknown): string | null {
  const failure = watchFailure(value);
  if (failure?.code === 'watch-full') return '手表空間不夠。先在手表上刪掉舊的一集。';
  if (failure?.code === 'watch-size') return '手表收到的音檔大小不對，這一集沒有存進去。';
  if (failure?.code === 'watch-network') return '手表連不上網路。請把手表連上 Wi‑Fi 或打開行動網路後再試。';
  if (failure?.code === 'watch-transfer') return '沒有傳到手表。請把手表解鎖，再按一次「傳到手表」。';
  return null;
}

export function applyWatchProgress(
  library: LibraryData,
  report: WatchProgressReport,
  nowIso: string,
): LibraryData {
  if (!findEpisode(library, report.episodeId)) return library;
  return {
    ...library,
    progressByEpisode: {
      ...library.progressByEpisode,
      [report.episodeId]: {
        positionMillis: report.positionMillis,
        durationMillis: report.durationMillis,
        updatedAt: nowIso,
        completed: report.completed,
      },
    },
  };
}
