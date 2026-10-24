import type { Episode, EpisodeProgress, LibraryData, Show } from '../../types/podcast';
import {
  clampAutoDownloadCount,
  heardDownloadedFilenames,
  libraryAfterHeard,
  libraryAfterUnheard,
  libraryWithoutHeardDownloads,
  missingDownloadIds,
  sortedEpisodes,
  wantedEpisodeIds,
} from '../autoDownload';
import { EMPTY_LIBRARY } from '../library';

function episode(id: string, publishedAt: string | null): Episode {
  return {
    id,
    title: id,
    publishedAt,
    enclosureUrl: `https://cdn.example/${id}.mp3`,
    enclosureType: 'audio/mpeg',
    expectedBytes: 1000,
    durationMillis: 60_000,
    summary: '',
  };
}

function show(episodes: Episode[], order: Show['episodeOrder'] = 'newest', count = 3): Show {
  return {
    id: 'show_1',
    feedUrl: 'https://example.com/feed.xml',
    title: '節目',
    author: '',
    artworkUrl: null,
    episodes,
    refreshedAt: '2026-10-01T00:00:00.000Z',
    episodeOrder: order,
    autoDownloadCount: count,
  };
}

const heard: EpisodeProgress = {
  positionMillis: 60_000,
  durationMillis: 60_000,
  updatedAt: '2026-10-02T00:00:00.000Z',
  completed: true,
};

describe('auto download queue', () => {
  const episodes = [
    episode('new', '2026-03-01T00:00:00.000Z'),
    episode('mid', '2026-02-01T00:00:00.000Z'),
    episode('old', '2026-01-01T00:00:00.000Z'),
    episode('same', '2026-02-01T00:00:00.000Z'),
    episode('undated', null),
    episode('bad-date', 'not-a-date'),
  ];

  it('clamps the download count', () => {
    expect(clampAutoDownloadCount(undefined)).toBe(3);
    expect(clampAutoDownloadCount(Number.NaN)).toBe(3);
    expect(clampAutoDownloadCount(-4)).toBe(0);
    expect(clampAutoDownloadCount(2.9)).toBe(2);
    expect(clampAutoDownloadCount(99)).toBe(20);
  });

  it('sorts dated episodes and leaves undated ones at the end', () => {
    expect(sortedEpisodes(episodes, 'newest').map((item) => item.id)).toEqual([
      'new',
      'mid',
      'same',
      'old',
      'undated',
      'bad-date',
    ]);
    expect(sortedEpisodes(episodes, 'oldest').map((item) => item.id)).toEqual([
      'old',
      'mid',
      'same',
      'new',
      'undated',
      'bad-date',
    ]);
    const dateless = [episode('a', null), episode('b', 'nope')];
    expect(sortedEpisodes(dateless, 'newest').map((item) => item.id)).toEqual(['a', 'b']);
    expect(sortedEpisodes(dateless, 'oldest').map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('keeps the first n unheard episodes and skips ones already on disk', () => {
    const podcast = show(episodes, 'oldest', 3);
    const progress = { mid: heard };
    expect(wantedEpisodeIds(episodes, 'oldest', 0, {})).toEqual([]);
    expect(wantedEpisodeIds(episodes, 'oldest', 3, progress)).toEqual(['old', 'same', 'new']);
    const library: LibraryData = {
      ...EMPTY_LIBRARY,
      shows: [podcast],
      progressByEpisode: progress,
      filesByEpisode: {
        old: { filename: 'ep_0000000000000001.mp3', bytes: 10, downloadedAt: '2026-10-01T00:00:00.000Z' },
      },
    };
    expect(missingDownloadIds(podcast, library.progressByEpisode, library.filesByEpisode)).toEqual(['same', 'new']);
  });

  it('marks an episode heard, drops its file, and queues the next unheard one', () => {
    const podcast = show(
      [episode('a', '2026-01-01T00:00:00.000Z'), episode('b', '2026-02-01T00:00:00.000Z'), episode('c', '2026-03-01T00:00:00.000Z'), episode('d', '2026-04-01T00:00:00.000Z')],
      'oldest',
      2,
    );
    const library: LibraryData = {
      ...EMPTY_LIBRARY,
      shows: [podcast],
      progressByEpisode: {
        a: { positionMillis: 1500, durationMillis: 60_000, updatedAt: '2026-10-02T00:00:00.000Z', completed: false },
      },
      filesByEpisode: {
        a: { filename: 'ep_000000000000000a.mp3', bytes: 10, downloadedAt: '2026-10-01T00:00:00.000Z' },
        b: { filename: 'ep_000000000000000b.mp3', bytes: 10, downloadedAt: '2026-10-01T00:00:00.000Z' },
      },
    };
    const bare = episode('bare', '2026-01-02T00:00:00.000Z');
    bare.durationMillis = null;
    const withBare: LibraryData = { ...library, shows: [{ ...podcast, episodes: [...podcast.episodes, bare] }] };
    const unmarked = libraryAfterHeard(withBare, 'bare', '2026-10-03T00:00:00.000Z');
    expect(unmarked.filename).toBeNull();
    expect(unmarked.library.progressByEpisode.bare?.positionMillis).toBe(0);
    expect(libraryAfterHeard(library, 'missing', '2026-10-03T00:00:00.000Z').filename).toBeNull();
    const heardLibrary = libraryAfterHeard(library, 'a', '2026-10-03T00:00:00.000Z');
    expect(heardLibrary.filename).toBe('ep_000000000000000a.mp3');
    expect(heardLibrary.library.filesByEpisode.a).toBeUndefined();
    expect(heardLibrary.library.progressByEpisode.a?.completed).toBe(true);
    expect(heardLibrary.library.progressByEpisode.a?.positionMillis).toBe(1500);
    expect(missingDownloadIds(podcast, heardLibrary.library.progressByEpisode, heardLibrary.library.filesByEpisode)).toEqual(['c']);

    const unheard = libraryAfterUnheard(heardLibrary.library, 'a', '2026-10-04T00:00:00.000Z');
    expect(unheard.progressByEpisode.a?.completed).toBe(false);
    expect(libraryAfterUnheard(unheard, 'a', '2026-10-05T00:00:00.000Z')).toBe(unheard);
    expect(libraryAfterUnheard(library, 'missing', '2026-10-05T00:00:00.000Z')).toBe(library);
  });

  it('removes downloads that were already marked heard', () => {
    const library: LibraryData = {
      ...EMPTY_LIBRARY,
      progressByEpisode: { a: heard },
      filesByEpisode: {
        a: { filename: 'ep_000000000000000a.mp3', bytes: 10, downloadedAt: '2026-10-01T00:00:00.000Z' },
        b: { filename: 'ep_000000000000000b.mp3', bytes: 10, downloadedAt: '2026-10-01T00:00:00.000Z' },
      },
    };
    expect(heardDownloadedFilenames(library)).toEqual(['ep_000000000000000a.mp3']);
    expect(libraryWithoutHeardDownloads(library).filesByEpisode.a).toBeUndefined();
    expect(libraryWithoutHeardDownloads(library).filesByEpisode.b?.filename).toBe('ep_000000000000000b.mp3');
    expect(libraryWithoutHeardDownloads(EMPTY_LIBRARY)).toBe(EMPTY_LIBRARY);
  });
});
