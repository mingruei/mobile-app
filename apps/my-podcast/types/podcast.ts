export type ParsedEpisode = {
  title: string;
  guid: string | null;
  publishedAt: string | null;
  enclosureUrl: string;
  enclosureType: string | null;
  expectedBytes: number | null;
  durationMillis: number | null;
  summary: string;
};

export type ParsedFeed = {
  title: string;
  author: string;
  artworkUrl: string | null;
  episodes: ParsedEpisode[];
};

export type EpisodeOrder = 'newest' | 'oldest';

export type Episode = {
  id: string;
  title: string;
  publishedAt: string | null;
  enclosureUrl: string;
  enclosureType: string | null;
  expectedBytes: number | null;
  durationMillis: number | null;
  summary: string;
};

export type Show = {
  id: string;
  feedUrl: string;
  title: string;
  author: string;
  artworkUrl: string | null;
  episodes: Episode[];
  refreshedAt: string;
  episodeOrder: EpisodeOrder;
  autoDownloadCount: number;
};

export type EpisodeProgress = {
  positionMillis: number;
  durationMillis: number | null;
  updatedAt: string;
  completed: boolean;
};

export type StoredEpisodeFile = {
  filename: string;
  bytes: number;
  downloadedAt: string;
};

export type LibraryData = {
  shows: Show[];
  progressByEpisode: Record<string, EpisodeProgress>;
  filesByEpisode: Record<string, StoredEpisodeFile>;
};

export type PlaybackPlan = {
  source: 'local' | 'download';
  positionMillis: number;
};
