import { episodeFilename, episodeIdFor, extensionForEpisode, normalizeFeedUrl, showIdForFeed, stableId } from '../identity';
import { applyFeed, findEpisode, findShowByFeedUrl, keptEpisodeIds, planPlayback, playbackStartMillis, toEpisode } from '../library';
import { parseDurationMillis } from '../media';
import { parsePodcastFeed } from '../rss';
import type { EpisodeProgress, Show } from '../../types/podcast';

const FEED = `<?xml version="1.0"?>
<rss><channel>
  <title><![CDATA[早安節目]]></title>
  <author>主持人</author>
  <image><url>https://cdn.example/art.jpg</url></image>
  <item>
    <title>有陷阱的一集</title>
    <description><![CDATA[這裡面有 </item> 字樣]]></description>
    <guid>episode-safe</guid>
    <pubDate>Thu, 02 Oct 2025 00:00:00 GMT</pubDate>
    <itunes:duration>1:02:03</itunes:duration>
    <enclosure url="https://cdn.example/safe.mp3?token=old&amp;x=2" length="5000000" type="audio/mpeg" />
  </item>
  <item>
    <title>影片</title>
    <media:content url="https://cdn.example/v.mp4" type="video/mp4" />
  </item>
  <item>
    <title>沒有 guid</title>
    <pubDate>not-a-date</pubDate>
    <media:content url="https://cdn.example/plain.m4a?token=1" type="audio/mp4" fileSize="8000000" />
  </item>
</channel></rss>`;

describe('podcast feed', () => {
  it('keeps the same episode when a signed media url changes', () => {
    const first = parsePodcastFeed(FEED);
    const second = parsePodcastFeed(FEED.replace('token=old', 'token=new'));
    expect(first?.title).toBe('早安節目');
    expect(first?.author).toBe('主持人');
    expect(first?.artworkUrl).toBe('https://cdn.example/art.jpg');
    expect(first?.episodes).toHaveLength(2);
    expect(first?.episodes[0]?.enclosureUrl).toBe('https://cdn.example/safe.mp3?token=old&x=2');
    expect(first?.episodes[0]?.durationMillis).toBe(parseDurationMillis('1:02:03'));
    expect(first?.episodes[1]?.publishedAt).toBeNull();

    const saved = toEpisode(first!.episodes[0]);
    const refreshed = toEpisode(second!.episodes[0]);
    expect(refreshed.id).toBe(saved.id);
    expect(refreshed.enclosureUrl).not.toBe(saved.enclosureUrl);
    expect(episodeIdFor(null, 'https://cdn.example/plain.m4a?token=1')).toBe(
      episodeIdFor(null, 'https://cdn.example/plain.m4a?token=2'),
    );
  });

  it('rejects an empty document and keeps a resumed episode that fell off the feed', () => {
    expect(parsePodcastFeed('<rss></rss>')).toBeNull();
    expect(parsePodcastFeed('\uFEFF<rss></rss>')).toBeNull();
    expect(parsePodcastFeed('<rss><channel><title>空節目</title></channel></rss>')?.episodes).toEqual([]);
    expect(parsePodcastFeed('<rss><channel><title>有圖</title><itunes:image href="https://cdn.example/cover.jpg" /></channel></rss>')?.artworkUrl).toBe(
      'https://cdn.example/cover.jpg',
    );
    expect(parsePodcastFeed('<rss><channel><title>無圖</title><itunes:image href="" /></channel></rss>')?.artworkUrl).toBeNull();

    const parsed = parsePodcastFeed(FEED)!;
    const existing: Show = applyFeed(null, parsed, 'https://example.com/feed.xml', '2026-10-01T00:00:00.000Z', []);
    const kept = existing.episodes[0];
    const withoutIt = {
      ...parsed,
      episodes: parsed.episodes.filter((episode) => episode.guid !== 'episode-safe'),
    };
    const updated = applyFeed(existing, withoutIt, existing.feedUrl, '2026-10-03T00:00:00.000Z', [kept.id]);
    expect(updated.episodes.some((episode) => episode.id === kept.id)).toBe(true);
    expect(updated.id).toBe(existing.id);
    expect(existing.episodeOrder).toBe('newest');
    expect(existing.autoDownloadCount).toBe(3);
    const ordered = applyFeed(
      { ...existing, episodeOrder: 'oldest', autoDownloadCount: 7 },
      parsed,
      existing.feedUrl,
      '2026-10-03T00:00:00.000Z',
      [],
    );
    expect(ordered.episodeOrder).toBe('oldest');
    expect(ordered.autoDownloadCount).toBe(7);
    expect(keptEpisodeIds({ shows: [existing], progressByEpisode: { [kept.id]: {
      positionMillis: 10_000,
      durationMillis: 60_000,
      updatedAt: '2026-10-02T00:00:00.000Z',
      completed: false,
    } }, filesByEpisode: {} }, existing)).toEqual([kept.id]);
    expect(findEpisode({ shows: [existing], progressByEpisode: {}, filesByEpisode: {} }, 'missing')).toBeNull();
    expect(playbackStartMillis(null, null)).toBe(0);
    expect(playbackStartMillis({
      positionMillis: Number.NaN,
      durationMillis: null,
      updatedAt: '2026-10-02T00:00:00.000Z',
      completed: false,
    }, null)).toBe(0);
  });
});

describe('resume plan', () => {
  const halfway: EpisodeProgress = {
    positionMillis: 600_000,
    durationMillis: 1_800_000,
    updatedAt: '2026-10-02T00:00:00.000Z',
    completed: false,
  };

  it('plays the local file from the saved position', () => {
    expect(
      planPlayback({
        fileExists: true,
        fileBytes: 5_000_000,
        expectedBytes: 5_000_000,
        progress: halfway,
        episodeDurationMillis: 1_800_000,
      }),
    ).toEqual({ source: 'local', positionMillis: 600_000 });
  });

  it('downloads again without forgetting the position when the file is missing or cut off', () => {
    expect(
      planPlayback({
        fileExists: false,
        fileBytes: 0,
        expectedBytes: 5_000_000,
        progress: halfway,
        episodeDurationMillis: 1_800_000,
      }),
    ).toEqual({ source: 'download', positionMillis: 600_000 });

    expect(
      planPlayback({
        fileExists: true,
        fileBytes: 20_000,
        expectedBytes: 5_000_000,
        progress: halfway,
        episodeDurationMillis: 1_800_000,
      }).source,
    ).toBe('download');

    expect(
      planPlayback({
        fileExists: true,
        fileBytes: 5_000_000,
        expectedBytes: 80_000_000,
        savedBytes: 5_000_000,
        progress: halfway,
        episodeDurationMillis: 1_800_000,
      }).source,
    ).toBe('local');
  });

  it('starts over after the episode was finished', () => {
    expect(
      planPlayback({
        fileExists: true,
        fileBytes: 5_000_000,
        expectedBytes: null,
        progress: { ...halfway, completed: true, positionMillis: 1_790_000 },
        episodeDurationMillis: 1_800_000,
      }),
    ).toEqual({ source: 'local', positionMillis: 0 });
  });
});

describe('feed urls', () => {
  it('ignores the fragment when matching a show', () => {
    const parsed = parsePodcastFeed(FEED)!;
    const show = applyFeed(null, parsed, 'https://example.com/feed.xml', '2026-10-03T00:00:00.000Z', []);
    expect(findShowByFeedUrl({ shows: [show], progressByEpisode: {}, filesByEpisode: {} }, 'https://example.com/feed.xml#top')?.id).toBe(show.id);
    expect(normalizeFeedUrl('notaurl')).toBeNull();
    expect(normalizeFeedUrl('   ')).toBeNull();
    expect(showIdForFeed('not a url').startsWith('show_')).toBe(true);
    expect(extensionForEpisode('audio/aac', 'https://cdn.example/a')).toBe('m4a');
    expect(extensionForEpisode('audio/opus', 'https://cdn.example/a')).toBe('ogg');
    expect(episodeFilename('ep_0123456789abcdef', 'exe')).toBe('ep_0123456789abcdef.mp3');
    expect(extensionForEpisode(null, 'https://cdn.example/show.m4b?token=1')).toBe('m4a');
    expect(stableId('same')).toBe(stableId('same'));
  });
});
