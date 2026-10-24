import type { LibraryData, Show } from '../types/podcast';
import { sortedEpisodes } from './autoDownload';
import { findEpisode, pickContinueListening } from './library';

export type WidgetPlayPlayer = {
  status: string;
  showId: string | null;
  episodeId: string | null;
};

export function isWidgetPlayUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'my-podcast:' && parsed.hostname === 'play';
  } catch {
    return false;
  }
}

export function widgetPlaySelection(
  library: LibraryData,
  player: WidgetPlayPlayer,
): { showId: string; episodeId: string } | null {
  if (player.status === 'playing' && player.showId && player.episodeId) {
    const found = findEpisode(library, player.episodeId);
    if (found?.show.id === player.showId) {
      return { showId: found.show.id, episodeId: found.episode.id };
    }
  }

  const show = playlistShow(library, player.showId);
  const episode = show
    ? sortedEpisodes(show.episodes, show.episodeOrder).find(
        (item) => library.progressByEpisode[item.id]?.completed !== true,
      )
    : null;
  if (!show || !episode) return null;
  return { showId: show.id, episodeId: episode.id };
}

function playlistShow(library: LibraryData, showId: string | null): Show | null {
  if (showId) {
    const current = library.shows.find((show) => show.id === showId);
    if (current) return current;
  }
  const recent = pickContinueListening(library);
  if (recent) {
    const show = library.shows.find((item) => item.id === recent.showId);
    if (show) return show;
  }
  return library.shows[0] ?? null;
}
