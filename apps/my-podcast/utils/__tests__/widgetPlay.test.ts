import type { Episode, EpisodeProgress, LibraryData, Show } from '../../types/podcast';
import { EMPTY_LIBRARY } from '../library';
import { isWidgetPlayUrl, widgetPlaySelection } from '../widgetPlay';

function episode(id: string, publishedAt: string): Episode {
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

function show(id: string, episodes: Episode[], order: Show['episodeOrder'] = 'newest'): Show {
  return {
    id,
    feedUrl: `https://example.com/${id}.xml`,
    title: id,
    author: '',
    artworkUrl: null,
    episodes,
    refreshedAt: '2026-10-01T00:00:00.000Z',
    episodeOrder: order,
    autoDownloadCount: 3,
  };
}

const heard: EpisodeProgress = {
  positionMillis: 60_000,
  durationMillis: 60_000,
  updatedAt: '2026-10-02T00:00:00.000Z',
  completed: true,
};

const idle = { status: 'idle', showId: null, episodeId: null };

describe('widget play', () => {
  const showA = show('show-a', [
    episode('a-new', '2026-03-01T00:00:00.000Z'),
    episode('a-mid', '2026-02-01T00:00:00.000Z'),
    episode('a-old', '2026-01-01T00:00:00.000Z'),
  ]);
  const showB = show(
    'show-b',
    [episode('b-new', '2026-04-01T00:00:00.000Z'), episode('b-old', '2026-01-15T00:00:00.000Z')],
    'oldest',
  );

  function library(progress: LibraryData['progressByEpisode'] = {}): LibraryData {
    return { ...EMPTY_LIBRARY, shows: [showA, showB], progressByEpisode: progress };
  }

  it('recognizes only the play link', () => {
    expect(isWidgetPlayUrl('my-podcast://play')).toBe(true);
    expect(isWidgetPlayUrl('my-podcast://play?source=widget')).toBe(true);
    expect(isWidgetPlayUrl('my-podcast://')).toBe(false);
    expect(isWidgetPlayUrl('my-podcast://open')).toBe(false);
    expect(isWidgetPlayUrl(null)).toBe(false);
  });

  it('keeps the episode that is already playing', () => {
    expect(
      widgetPlaySelection(library(), {
        status: 'playing',
        showId: 'show-a',
        episodeId: 'a-old',
      }),
    ).toEqual({ showId: 'show-a', episodeId: 'a-old' });
  });

  it('uses the current show order when nothing is playing', () => {
    expect(
      widgetPlaySelection(library({ 'a-new': heard }), {
        status: 'paused',
        showId: 'show-a',
        episodeId: 'a-old',
      }),
    ).toEqual({ showId: 'show-a', episodeId: 'a-mid' });
    expect(
      widgetPlaySelection(library(), {
        status: 'paused',
        showId: 'show-b',
        episodeId: 'b-new',
      }),
    ).toEqual({ showId: 'show-b', episodeId: 'b-old' });
  });

  it('uses the most recently heard show, then the first show', () => {
    expect(
      widgetPlaySelection(
        library({
          'b-old': {
            positionMillis: 8000,
            durationMillis: 60_000,
            updatedAt: '2026-10-03T00:00:00.000Z',
            completed: false,
          },
        }),
        idle,
      ),
    ).toEqual({ showId: 'show-b', episodeId: 'b-old' });
    expect(widgetPlaySelection(library(), idle)).toEqual({ showId: 'show-a', episodeId: 'a-new' });
  });

  it('returns nothing when every episode in the playlist is already heard', () => {
    expect(
      widgetPlaySelection(
        library({
          'a-new': heard,
          'a-mid': heard,
          'a-old': heard,
        }),
        { status: 'paused', showId: 'show-a', episodeId: 'a-old' },
      ),
    ).toBeNull();
    expect(widgetPlaySelection(EMPTY_LIBRARY, idle)).toBeNull();
  });
});
