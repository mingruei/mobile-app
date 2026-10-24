export type PodcastSearchHit = {
  title: string;
  author: string;
  feedUrl: string;
  artworkUrl: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function parseItunesResults(payload: unknown): PodcastSearchHit[] {
  const record = asRecord(payload);
  if (!record || !Array.isArray(record.results)) return [];
  const hits: PodcastSearchHit[] = [];
  for (const item of record.results) {
    const result = asRecord(item);
    const feedUrl = result?.feedUrl;
    const title = result?.collectionName;
    if (typeof feedUrl !== 'string' || !/^https?:\/\//i.test(feedUrl)) continue;
    if (typeof title !== 'string' || title.trim().length === 0) continue;
    const artwork = result?.artworkUrl600 ?? result?.artworkUrl100;
    hits.push({
      title: title.trim(),
      author: typeof result?.artistName === 'string' ? result.artistName : '',
      feedUrl,
      artworkUrl: typeof artwork === 'string' ? artwork : null,
    });
  }
  return hits;
}
