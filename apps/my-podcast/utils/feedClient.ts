import type { ParsedFeed } from '../types/podcast';
import { parseItunesResults, type PodcastSearchHit } from './itunes';
import { parsePodcastFeed } from './rss';

const USER_AGENT = 'MyPodcast/1.0';

export async function loadFeed(feedUrl: string): Promise<ParsedFeed> {
  const response = await fetch(feedUrl, {
    headers: {
      Accept: 'application/rss+xml, application/xml, text/xml, */*',
      'User-Agent': USER_AGENT,
    },
  });
  if (!response.ok) {
    throw new Error(`Feed request failed (${response.status})`);
  }
  const parsed = parsePodcastFeed(await response.text());
  if (!parsed) {
    throw new Error('Feed did not contain a podcast');
  }
  return parsed;
}

export async function searchShows(term: string): Promise<PodcastSearchHit[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=TW&media=podcast&entity=podcast&limit=20`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`Search failed (${response.status})`);
  }
  return parseItunesResults(await response.json());
}
