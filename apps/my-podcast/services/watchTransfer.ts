import { requireOptionalNativeModule } from 'expo';

type WatchSubscription = { remove: () => void };

type WatchNative = {
  preparePlayback(uri: string): Promise<void>;
  sendEpisode(details: {
    uri: string;
    episodeId: string;
    title: string;
    showTitle: string;
    positionMillis: number;
    startPlayback: boolean;
    publishedAt?: string | null;
    episodeOrder?: 'newest' | 'oldest';
  }): Promise<void>;
  latestProgress(): unknown;
  deleteEpisodeOnWatch(episodeId: string): void;
  addListener(eventName: 'progress', listener: (payload: unknown) => void): WatchSubscription;
};

const native = requireOptionalNativeModule<WatchNative>('WatchTransfer');

export function watchTransferAvailable(): boolean {
  return native != null;
}

export async function prepareLocalPlayback(uri: string): Promise<void> {
  if (!native) return;
  try {
    await native.preparePlayback(uri);
  } catch {
    // Playback still tries the file when its protection cannot be changed.
  }
}

export async function sendEpisodeToWatch(input: {
  uri: string;
  episodeId: string;
  title: string;
  showTitle: string;
  positionMillis: number;
  startPlayback: boolean;
  publishedAt?: string | null;
  episodeOrder?: 'newest' | 'oldest';
}): Promise<void> {
  if (!native) {
    throw new Error('請重新安裝到 iPhone，手表功能才會裝上。');
  }
  await native.sendEpisode({
    uri: input.uri,
    episodeId: input.episodeId,
    title: input.title,
    showTitle: input.showTitle,
    positionMillis: input.positionMillis,
    startPlayback: input.startPlayback,
    publishedAt: input.publishedAt ?? null,
    episodeOrder: input.episodeOrder === 'oldest' ? 'oldest' : 'newest',
  });
}

export function readLatestWatchProgress(): unknown {
  return native?.latestProgress() ?? null;
}

export function deleteEpisodeOnWatch(episodeId: string): void {
  native?.deleteEpisodeOnWatch(episodeId);
}

export function addWatchProgressListener(listener: (payload: unknown) => void): { remove: () => void } {
  if (!native) return { remove: () => undefined };
  const subscription = native.addListener('progress', listener);
  return { remove: () => subscription.remove() };
}
