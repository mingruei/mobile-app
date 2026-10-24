import type {
  Episode,
  EpisodeOrder,
  EpisodeProgress,
  LibraryData,
  Show,
  StoredEpisodeFile,
} from '../types/podcast';

export const DEFAULT_AUTO_DOWNLOAD_COUNT = 3;
export const MAX_AUTO_DOWNLOAD_COUNT = 20;

export function clampAutoDownloadCount(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_AUTO_DOWNLOAD_COUNT;
  return Math.max(0, Math.min(MAX_AUTO_DOWNLOAD_COUNT, Math.floor(value)));
}

function publishedTime(episode: Episode): number | null {
  if (!episode.publishedAt) return null;
  const time = Date.parse(episode.publishedAt);
  return Number.isNaN(time) ? null : time;
}

export function sortedEpisodes(episodes: readonly Episode[], order: EpisodeOrder): Episode[] {
  const dated = episodes.some((episode) => publishedTime(episode) != null);
  if (!dated) return order === 'oldest' ? [...episodes].reverse() : [...episodes];

  return episodes
    .map((episode, index) => ({ episode, index, time: publishedTime(episode) }))
    .sort((left, right) => {
      if (left.time == null && right.time == null) return left.index - right.index;
      if (left.time == null) return 1;
      if (right.time == null) return -1;
      if (left.time === right.time) return left.index - right.index;
      return order === 'oldest' ? left.time - right.time : right.time - left.time;
    })
    .map((item) => item.episode);
}

export function isHeard(progress: EpisodeProgress | undefined): boolean {
  return progress?.completed === true;
}

export function wantedEpisodeIds(
  episodes: readonly Episode[],
  order: EpisodeOrder,
  count: number,
  progressByEpisode: Record<string, EpisodeProgress>,
): string[] {
  const limit = clampAutoDownloadCount(count);
  if (limit === 0) return [];
  return sortedEpisodes(episodes, order)
    .filter((episode) => !isHeard(progressByEpisode[episode.id]))
    .slice(0, limit)
    .map((episode) => episode.id);
}

export function missingDownloadIds(
  show: Show,
  progressByEpisode: Record<string, EpisodeProgress>,
  filesByEpisode: Record<string, StoredEpisodeFile>,
): string[] {
  return wantedEpisodeIds(show.episodes, show.episodeOrder, show.autoDownloadCount, progressByEpisode).filter(
    (episodeId) => !filesByEpisode[episodeId],
  );
}

export function libraryAfterHeard(
  library: LibraryData,
  episodeId: string,
  nowIso: string,
): { library: LibraryData; filename: string | null } {
  const show = library.shows.find((item) => item.episodes.some((episode) => episode.id === episodeId));
  const episode = show?.episodes.find((item) => item.id === episodeId);
  if (!episode) return { library, filename: null };

  const previous = library.progressByEpisode[episodeId];
  const filename = library.filesByEpisode[episodeId]?.filename ?? null;
  const filesByEpisode = { ...library.filesByEpisode };
  delete filesByEpisode[episodeId];
  return {
    filename,
    library: {
      ...library,
      filesByEpisode,
      progressByEpisode: {
        ...library.progressByEpisode,
        [episodeId]: {
          positionMillis: previous?.positionMillis ?? episode.durationMillis ?? 0,
          durationMillis: previous?.durationMillis ?? episode.durationMillis,
          updatedAt: nowIso,
          completed: true,
        },
      },
    },
  };
}

export function libraryAfterUnheard(library: LibraryData, episodeId: string, nowIso: string): LibraryData {
  const previous = library.progressByEpisode[episodeId];
  const known = library.shows.some((show) => show.episodes.some((episode) => episode.id === episodeId));
  if (!known || !previous?.completed) return library;
  return {
    ...library,
    progressByEpisode: {
      ...library.progressByEpisode,
      [episodeId]: { ...previous, completed: false, updatedAt: nowIso },
    },
  };
}

export function heardDownloadedFilenames(library: LibraryData): string[] {
  return Object.entries(library.filesByEpisode).flatMap(([episodeId, file]) =>
    library.progressByEpisode[episodeId]?.completed === true ? [file.filename] : [],
  );
}

export function libraryWithoutHeardDownloads(library: LibraryData): LibraryData {
  const heard = new Set(
    Object.keys(library.filesByEpisode).filter((episodeId) => library.progressByEpisode[episodeId]?.completed === true),
  );
  if (heard.size === 0) return library;
  const filesByEpisode = { ...library.filesByEpisode };
  for (const episodeId of heard) delete filesByEpisode[episodeId];
  return { ...library, filesByEpisode };
}
