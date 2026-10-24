import type {
  Episode,
  EpisodeProgress,
  LibraryData,
  Show,
  StoredEpisodeFile,
} from '../types/podcast';
import { clampAutoDownloadCount } from './autoDownload';
import { EMPTY_LIBRARY } from './library';

export const LIBRARY_KEY = 'my-podcast.library.v1';

const FILENAME_PATTERN = /^ep_[0-9a-f]{16}\.(mp3|m4a|aac|wav|ogg|flac)$/;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asBytes(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

function parseEpisode(value: unknown): Episode | null {
  const record = asRecord(value);
  const id = asString(record?.id);
  const enclosureUrl = asString(record?.enclosureUrl);
  if (!record || !id || !enclosureUrl) return null;
  return {
    id,
    title: asString(record.title) ?? '未命名單集',
    publishedAt: asNullableString(record.publishedAt),
    enclosureUrl,
    enclosureType: asNullableString(record.enclosureType),
    expectedBytes: asBytes(record.expectedBytes),
    durationMillis: asBytes(record.durationMillis),
    summary: typeof record.summary === 'string' ? record.summary : '',
  };
}

function parseShow(value: unknown): Show | null {
  const record = asRecord(value);
  const id = asString(record?.id);
  const feedUrl = asString(record?.feedUrl);
  if (!record || !id || !feedUrl || !Array.isArray(record.episodes)) return null;
  return {
    id,
    feedUrl,
    title: asString(record.title) ?? '未命名節目',
    author: typeof record.author === 'string' ? record.author : '',
    artworkUrl: asNullableString(record.artworkUrl),
    episodes: record.episodes.map(parseEpisode).filter((episode): episode is Episode => episode !== null),
    refreshedAt: asString(record.refreshedAt) ?? new Date(0).toISOString(),
    episodeOrder: record.episodeOrder === 'oldest' ? 'oldest' : 'newest',
    autoDownloadCount: clampAutoDownloadCount(
      typeof record.autoDownloadCount === 'number' ? record.autoDownloadCount : undefined,
    ),
  };
}

function parseProgress(value: unknown): EpisodeProgress | null {
  const record = asRecord(value);
  if (!record || typeof record.positionMillis !== 'number' || !Number.isFinite(record.positionMillis)) {
    return null;
  }
  return {
    positionMillis: Math.max(0, Math.floor(record.positionMillis)),
    durationMillis: asBytes(record.durationMillis),
    updatedAt: asString(record.updatedAt) ?? new Date(0).toISOString(),
    completed: record.completed === true,
  };
}

function parseFile(value: unknown): StoredEpisodeFile | null {
  const record = asRecord(value);
  const filename = asString(record?.filename);
  const bytes = asBytes(record?.bytes);
  if (!filename || !FILENAME_PATTERN.test(filename) || bytes == null) return null;
  return {
    filename,
    bytes,
    downloadedAt: asString(record?.downloadedAt) ?? new Date(0).toISOString(),
  };
}

function parseRecordMap<T>(value: unknown, parse: (item: unknown) => T | null): Record<string, T> {
  const record = asRecord(value);
  if (!record) return {};
  const entries = Object.entries(record).flatMap(([key, item]) => {
    const parsed = parse(item);
    return parsed ? [[key, parsed] as const] : [];
  });
  return Object.fromEntries(entries);
}

export function parseLibrary(raw: string | null): LibraryData {
  if (!raw) return EMPTY_LIBRARY;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const record = asRecord(parsed);
    if (!record || !Array.isArray(record.shows)) return EMPTY_LIBRARY;
    return {
      shows: record.shows.map(parseShow).filter((show): show is Show => show !== null),
      progressByEpisode: parseRecordMap(record.progressByEpisode, parseProgress),
      filesByEpisode: parseRecordMap(record.filesByEpisode, parseFile),
    };
  } catch {
    return EMPTY_LIBRARY;
  }
}

export function serializeLibrary(library: LibraryData): string {
  return JSON.stringify(library);
}
