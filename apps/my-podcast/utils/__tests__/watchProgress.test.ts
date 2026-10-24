import type { LibraryData, Show } from '../../types/podcast';
import { episodeIdFor } from '../identity';
import { EMPTY_LIBRARY } from '../library';
import {
  applyWatchProgress,
  parseWatchProgress,
  parseWatchTransferProgress,
  watchEventMessage,
  watchSavedId,
} from '../watchProgress';

function showWithEpisode(): { library: LibraryData; episodeId: string } {
  const episodeId = episodeIdFor('watch-me', 'https://cdn.example/watch.mp3');
  const show: Show = {
    id: 'show_watch',
    feedUrl: 'https://example.com/feed.xml',
    title: '節目',
    author: '',
    artworkUrl: null,
    refreshedAt: '2026-10-03T00:00:00.000Z',
    episodeOrder: 'newest',
    autoDownloadCount: 3,
    episodes: [
      {
        id: episodeId,
        title: '第一集',
        publishedAt: null,
        enclosureUrl: 'https://cdn.example/watch.mp3',
        enclosureType: 'audio/mpeg',
        expectedBytes: null,
        durationMillis: null,
        summary: '',
      },
    ],
  };
  return { library: { ...EMPTY_LIBRARY, shows: [show] }, episodeId };
}

describe('watch progress', () => {
  it('keeps the position reported by the watch', () => {
    const { library, episodeId } = showWithEpisode();
    const report = parseWatchProgress({
      episodeId,
      positionMillis: 125_000.8,
      durationMillis: 600_000,
      completed: false,
    });
    expect(report?.positionMillis).toBe(125_000);
    const next = applyWatchProgress(library, report!, '2026-10-03T01:00:00.000Z');
    expect(next.progressByEpisode[episodeId]).toEqual({
      positionMillis: 125_000,
      durationMillis: 600_000,
      updatedAt: '2026-10-03T01:00:00.000Z',
      completed: false,
    });
  });

  it('ignores a report for an unknown episode and a full watch', () => {
    const { library } = showWithEpisode();
    expect(parseWatchProgress({ positionMillis: 1 })).toBeNull();
    expect(parseWatchProgress(null)).toBeNull();
    const unknown = parseWatchProgress({ episodeId: 'missing', positionMillis: 10, completed: false });
    expect(applyWatchProgress(library, unknown!, '2026-10-03T01:00:00.000Z')).toBe(library);
    expect(watchEventMessage({ error: 'watch-full' })).toBe('手表空間不夠。先在手表上刪掉舊的一集。');
    expect(watchEventMessage({ error: 'watch-size', episodeId: 'ep_1' })).toBe(
      '手表收到的音檔大小不對，這一集沒有存進去。',
    );
    expect(watchEventMessage({ error: 'watch-network' })).toBe(
      '手表連不上網路。請把手表連上 Wi‑Fi 或打開行動網路後再試。',
    );
    expect(watchEventMessage({ error: 'watch-transfer' })).toBe(
      '沒有傳到手表。請把手表解鎖，再按一次「傳到手表」。',
    );
    expect(watchEventMessage({ error: 'other' })).toBeNull();
    expect(
      parseWatchTransferProgress({
        watchTransferProgress: true,
        episodeId: 'ep_1',
        written: 1024,
        bytes: 2048,
      }),
    ).toEqual({ episodeId: 'ep_1', written: 1024, expected: 2048 });
    expect(watchSavedId({ watchSaved: 'ep_1', bytes: 2048 })).toBe('ep_1');
    expect(watchSavedId({ watchSaved: 'ep_1', bytes: 0 })).toBeNull();
    expect(watchSavedId({ watchSaved: 'ep_1' })).toBe('ep_1');
  });
});
