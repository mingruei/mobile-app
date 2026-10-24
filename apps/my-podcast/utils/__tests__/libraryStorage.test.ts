import type { EpisodeProgress, LibraryData, Show } from '../../types/podcast';
import { episodeFilename, episodeIdFor } from '../identity';
import {
  EMPTY_LIBRARY,
  pickContinueListening,
  playbackStartMillis,
  removeShowFromLibrary,
  upsertShow,
} from '../library';
import { parseLibrary, serializeLibrary } from '../libraryStorage';
import { parseItunesResults } from '../itunes';

const progress: EpisodeProgress = {
  positionMillis: 120_000,
  durationMillis: 600_000,
  updatedAt: '2026-10-02T00:00:00.000Z',
  completed: false,
};

function sampleShow(): Show {
  return {
    id: 'show_0123456789abcdef',
    feedUrl: 'https://example.com/feed.xml',
    title: '節目',
    author: '',
    artworkUrl: null,
    refreshedAt: '2026-10-01T00:00:00.000Z',
    episodeOrder: 'newest',
    autoDownloadCount: 3,
    episodes: [
      {
        id: episodeIdFor('one', 'https://cdn.example/one.mp3'),
        title: '第一集',
        publishedAt: null,
        enclosureUrl: 'https://cdn.example/one.mp3',
        enclosureType: 'audio/mpeg',
        expectedBytes: 100_000,
        durationMillis: 600_000,
        summary: '',
      },
    ],
  };
}

describe('library storage', () => {
  it('drops corrupt records and keeps a valid download name', () => {
    expect(parseLibrary(null)).toEqual(EMPTY_LIBRARY);
    expect(parseLibrary('not-json')).toEqual(EMPTY_LIBRARY);
    expect(parseLibrary('{"shows":"nope"}')).toEqual(EMPTY_LIBRARY);
    const messy = parseLibrary(JSON.stringify({
      shows: [
        {
          id: 'show_1',
          feedUrl: 'https://example.com/feed.xml',
          episodes: [{ id: 'ep_1', enclosureUrl: 'https://cdn.example/a.mp3' }, { title: 'x' }],
        },
        { title: '壞掉' },
        'nope',
      ],
      progressByEpisode: { ep_1: { positionMillis: 10 }, nope: [] },
      filesByEpisode: null,
    }));
    expect(messy.shows[0]?.title).toBe('未命名節目');
    expect(messy.shows[0]?.episodes[0]?.title).toBe('未命名單集');
    expect(messy.shows[0]?.episodes).toHaveLength(1);
    expect(messy.shows[0]?.episodeOrder).toBe('newest');
    expect(messy.shows[0]?.autoDownloadCount).toBe(3);
    const ordered = parseLibrary(JSON.stringify({
      shows: [{
        id: 'show_2',
        feedUrl: 'https://example.com/old.xml',
        episodeOrder: 'oldest',
        autoDownloadCount: 25.9,
        episodes: [],
      }],
    }));
    expect(ordered.shows[0]?.episodeOrder).toBe('oldest');
    expect(ordered.shows[0]?.autoDownloadCount).toBe(20);
    expect(messy.progressByEpisode.ep_1?.completed).toBe(false);
    expect(messy.filesByEpisode).toEqual({});

    const show = sampleShow();
    const episodeId = show.episodes[0].id;
    const library: LibraryData = {
      shows: [show],
      progressByEpisode: { [episodeId]: progress, bad: { nope: true } as unknown as EpisodeProgress },
      filesByEpisode: {
        [episodeId]: {
          filename: episodeFilename(episodeId, 'mp3'),
          bytes: 100_000,
          downloadedAt: '2026-10-02T00:00:00.000Z',
        },
        other: { filename: '../secret.mp3', bytes: 10, downloadedAt: '2026-10-02T00:00:00.000Z' },
      },
    };

    const parsed = parseLibrary(serializeLibrary(library));
    expect(parsed.shows[0]?.title).toBe('節目');
    expect(parsed.progressByEpisode[episodeId]?.positionMillis).toBe(120_000);
    expect(parsed.progressByEpisode.bad).toBeUndefined();
    expect(parsed.filesByEpisode[episodeId]?.filename.endsWith('.mp3')).toBe(true);
    expect(parsed.filesByEpisode.other).toBeUndefined();
  });

  it('picks the newest unfinished episode and removes its file with the show', () => {
    const show = sampleShow();
    const episodeId = show.episodes[0].id;
    const older: EpisodeProgress = { ...progress, updatedAt: '2026-10-01T00:00:00.000Z', positionMillis: 3_000 };
    const library: LibraryData = {
      shows: [show],
      progressByEpisode: { [episodeId]: progress, missing: older },
      filesByEpisode: {
        [episodeId]: {
          filename: episodeFilename(episodeId, 'mp3'),
          bytes: 100_000,
          downloadedAt: '2026-10-02T00:00:00.000Z',
        },
      },
    };

    expect(pickContinueListening(library)).toEqual({ showId: show.id, episodeId });
    expect(pickContinueListening({ ...library, progressByEpisode: { [episodeId]: { ...progress, completed: true } } })).toBeNull();
    expect(playbackStartMillis({ ...progress, positionMillis: -5 }, 600_000)).toBe(0);
    expect(playbackStartMillis({ ...progress, positionMillis: 599_800 }, 600_000)).toBe(0);

    const removed = removeShowFromLibrary(library, show.id);
    expect(removed.library.shows).toHaveLength(0);
    expect(removed.filenames).toHaveLength(1);
    expect(removed.episodeIds).toEqual([episodeId]);

    const inserted = upsertShow(EMPTY_LIBRARY, show);
    expect(upsertShow(inserted, { ...show, title: '新名稱' }).shows[0]?.title).toBe('新名稱');
  });
});

describe('itunes search', () => {
  it('keeps podcast hits that include an http feed', () => {
    expect(parseItunesResults(null)).toEqual([]);
    expect(
      parseItunesResults({
        results: [
          { collectionName: '大圖', artistName: '人', feedUrl: 'https://example.com/big.xml', artworkUrl600: 'https://example.com/big.jpg' },
          { collectionName: '沒有 feed', artistName: '人' },
          { collectionName: '壞網址', feedUrl: 'ftp://example.com/feed' },
          { feedUrl: 'https://example.com/other.xml' },
        ],
      }),
    ).toEqual([
      {
        title: '大圖',
        author: '人',
        feedUrl: 'https://example.com/big.xml',
        artworkUrl: 'https://example.com/big.jpg',
      },
    ]);
  });
});
