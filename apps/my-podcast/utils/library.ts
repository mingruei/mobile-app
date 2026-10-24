import type {
  Episode,
  EpisodeProgress,
  LibraryData,
  ParsedEpisode,
  ParsedFeed,
  PlaybackPlan,
  Show,
} from '../types/podcast';
import { clampAutoDownloadCount } from './autoDownload';
import { episodeIdFor, normalizeFeedUrl, showIdForFeed } from './identity';
import { savedFileIsPlayable } from './media';

export const MAX_EPISODES = 200;
const CONTINUE_AFTER_MILLIS = 5000;

export const EMPTY_LIBRARY: LibraryData = {
  shows: [],
  progressByEpisode: {},
  filesByEpisode: {},
};

export function toEpisode(parsed: ParsedEpisode): Episode {
  return {
    id: episodeIdFor(parsed.guid, parsed.enclosureUrl),
    title: parsed.title,
    publishedAt: parsed.publishedAt,
    enclosureUrl: parsed.enclosureUrl,
    enclosureType: parsed.enclosureType,
    expectedBytes: parsed.expectedBytes,
    durationMillis: parsed.durationMillis,
    summary: parsed.summary,
  };
}

export function applyFeed(
  existing: Show | null,
  parsed: ParsedFeed,
  feedUrl: string,
  nowIso: string,
  keepEpisodeIds: readonly string[],
): Show {
  const seen = new Set<string>();
  const fresh: Episode[] = [];
  for (const parsedEpisode of parsed.episodes) {
    const episode = toEpisode(parsedEpisode);
    if (seen.has(episode.id)) continue;
    seen.add(episode.id);
    fresh.push(episode);
    if (fresh.length >= MAX_EPISODES) break;
  }

  const keep = new Set(keepEpisodeIds);
  const retained = (existing?.episodes ?? []).filter(
    (episode) => keep.has(episode.id) && !seen.has(episode.id),
  );

  return {
    id: existing?.id ?? showIdForFeed(feedUrl),
    feedUrl,
    title: parsed.title || existing?.title || '未命名節目',
    author: parsed.author || existing?.author || '',
    artworkUrl: parsed.artworkUrl ?? existing?.artworkUrl ?? null,
    episodes: [...fresh, ...retained],
    refreshedAt: nowIso,
    episodeOrder: existing?.episodeOrder === 'oldest' ? 'oldest' : 'newest',
    autoDownloadCount: clampAutoDownloadCount(existing?.autoDownloadCount),
  };
}

export function upsertShow(library: LibraryData, show: Show): LibraryData {
  const exists = library.shows.some((item) => item.id === show.id);
  return {
    ...library,
    shows: exists ? library.shows.map((item) => (item.id === show.id ? show : item)) : [show, ...library.shows],
  };
}

export function findEpisode(
  library: LibraryData,
  episodeId: string,
): { show: Show; episode: Episode } | null {
  for (const show of library.shows) {
    const episode = show.episodes.find((item) => item.id === episodeId);
    if (episode) return { show, episode };
  }
  return null;
}

export function findShowByFeedUrl(library: LibraryData, feedUrl: string): Show | null {
  const normalized = normalizeFeedUrl(feedUrl);
  if (!normalized) return null;
  return library.shows.find((show) => normalizeFeedUrl(show.feedUrl) === normalized) ?? null;
}

export function playbackStartMillis(
  progress: EpisodeProgress | null,
  episodeDurationMillis: number | null,
): number {
  if (!progress || progress.completed) return 0;
  const position = Number.isFinite(progress.positionMillis) ? Math.max(0, Math.floor(progress.positionMillis)) : 0;
  const duration = progress.durationMillis ?? episodeDurationMillis;
  if (duration != null && duration > 0 && position >= duration - 500) return 0;
  return position;
}

export function planPlayback(input: {
  fileExists: boolean;
  fileBytes: number;
  expectedBytes: number | null;
  savedBytes?: number | null;
  progress: EpisodeProgress | null;
  episodeDurationMillis: number | null;
}): PlaybackPlan {
  const positionMillis = playbackStartMillis(input.progress, input.episodeDurationMillis);
  const source = savedFileIsPlayable(
    { exists: input.fileExists, bytes: input.fileBytes },
    input.savedBytes ?? null,
    input.expectedBytes,
  )
    ? 'local'
    : 'download';
  return { source, positionMillis };
}

export function pickContinueListening(
  library: LibraryData,
): { showId: string; episodeId: string } | null {
  let best: { showId: string; episodeId: string; updatedAt: string } | null = null;
  for (const [episodeId, progress] of Object.entries(library.progressByEpisode)) {
    if (progress.completed || progress.positionMillis < CONTINUE_AFTER_MILLIS) continue;
    const found = findEpisode(library, episodeId);
    if (!found) continue;
    if (!best || progress.updatedAt > best.updatedAt) {
      best = { showId: found.show.id, episodeId, updatedAt: progress.updatedAt };
    }
  }
  return best ? { showId: best.showId, episodeId: best.episodeId } : null;
}

export function removeShowFromLibrary(
  library: LibraryData,
  showId: string,
): { library: LibraryData; filenames: string[]; episodeIds: string[] } {
  const show = library.shows.find((item) => item.id === showId);
  const episodeIds = show?.episodes.map((episode) => episode.id) ?? [];
  const filenames = episodeIds.flatMap((episodeId) => {
    const filename = library.filesByEpisode[episodeId]?.filename;
    return filename ? [filename] : [];
  });
  const progressByEpisode = { ...library.progressByEpisode };
  const filesByEpisode = { ...library.filesByEpisode };
  for (const episodeId of episodeIds) {
    delete progressByEpisode[episodeId];
    delete filesByEpisode[episodeId];
  }
  return {
    library: {
      shows: library.shows.filter((item) => item.id !== showId),
      progressByEpisode,
      filesByEpisode,
    },
    filenames,
    episodeIds,
  };
}

export function keptEpisodeIds(library: LibraryData, show: Show): string[] {
  const ids = new Set(show.episodes.map((episode) => episode.id));
  const kept = new Set<string>();
  for (const episodeId of ids) {
    if (library.progressByEpisode[episodeId] || library.filesByEpisode[episodeId]) {
      kept.add(episodeId);
    }
  }
  return [...kept];
}
