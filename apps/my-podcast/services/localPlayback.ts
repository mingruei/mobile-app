import { requireOptionalNativeModule } from 'expo';

type PlaybackSubscription = { remove: () => void };

export type LocalPlaybackStatus = {
  playing: boolean;
  finished: boolean;
  positionMillis: number;
  durationMillis: number;
  filename?: string;
};

type PlaybackNative = {
  playLocal(uri: string, positionMillis: number, title: string, showTitle: string): Promise<unknown>;
  loadLocal(uri: string, positionMillis: number, title: string, showTitle: string): Promise<unknown>;
  pauseLocal(): LocalPlaybackStatus;
  resumeLocal(): LocalPlaybackStatus;
  seekLocal(positionMillis: number): LocalPlaybackStatus;
  stopLocal(): void;
  localStatus(): unknown;
  addListener(eventName: 'playback', listener: (payload: unknown) => void): PlaybackSubscription;
};

const native = requireOptionalNativeModule<PlaybackNative>('WatchTransfer');

export function parseLocalStatus(value: unknown): LocalPlaybackStatus | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const positionMillis = Number(record.positionMillis);
  const durationMillis = Number(record.durationMillis);
  if (!Number.isFinite(positionMillis) || !Number.isFinite(durationMillis)) return null;
  const filename = typeof record.filename === 'string' ? record.filename : undefined;
  return {
    playing: record.playing === true,
    finished: record.finished === true,
    positionMillis,
    durationMillis,
    ...(filename ? { filename } : {}),
  };
}

function read(value: unknown): LocalPlaybackStatus {
  const status = parseLocalStatus(value);
  if (!status) throw new Error('播放器沒有回報狀態。');
  return status;
}

export async function playLocalFile(
  uri: string,
  positionMillis: number,
  title: string,
  showTitle: string,
): Promise<LocalPlaybackStatus> {
  if (!native) throw new Error('請重新安裝到 iPhone。');
  return read(await native.playLocal(uri, positionMillis, title, showTitle));
}

export async function loadLocalFile(
  uri: string,
  positionMillis: number,
  title: string,
  showTitle: string,
): Promise<LocalPlaybackStatus> {
  if (!native) throw new Error('請重新安裝到 iPhone。');
  return read(await native.loadLocal(uri, positionMillis, title, showTitle));
}

export function pauseLocalFile(): LocalPlaybackStatus {
  if (!native) throw new Error('請重新安裝到 iPhone。');
  return read(native.pauseLocal());
}

export function resumeLocalFile(): LocalPlaybackStatus {
  if (!native) throw new Error('請重新安裝到 iPhone。');
  return read(native.resumeLocal());
}

export function seekLocalFile(positionMillis: number): LocalPlaybackStatus {
  if (!native) throw new Error('請重新安裝到 iPhone。');
  return read(native.seekLocal(positionMillis));
}

export function stopLocalFile(): void {
  native?.stopLocal();
}

export function readLocalStatus(): LocalPlaybackStatus | null {
  if (!native) return null;
  return parseLocalStatus(native.localStatus());
}

export function addLocalPlaybackListener(listener: (payload: unknown) => void): { remove: () => void } {
  if (!native) return { remove: () => undefined };
  const subscription = native.addListener('playback', listener);
  return { remove: () => subscription.remove() };
}
