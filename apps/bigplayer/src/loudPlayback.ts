import { EventEmitter, requireOptionalNativeModule, type NativeModule } from 'expo';
import { Platform } from 'react-native';
import type { AVPlaybackStatus } from 'expo-av';

type LoudPlaybackNative = NativeModule & {
  load(uri: string, volume: number): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  unload(): Promise<void>;
  setVolume(volume: number): Promise<void>;
  seek(seconds: number): Promise<void>;
  getStatus(): Promise<{
    isLoaded: boolean;
    isPlaying: boolean;
    positionMillis: number;
    durationMillis: number;
  }>;
};

export type SoundLike = {
  playAsync: () => Promise<unknown>;
  pauseAsync: () => Promise<unknown>;
  unloadAsync: () => Promise<unknown>;
  setVolumeAsync: (volume: number) => Promise<unknown>;
  setPositionAsync: (millis: number) => Promise<unknown>;
  getStatusAsync: () => Promise<AVPlaybackStatus>;
  setOnPlaybackStatusUpdate: (callback: ((status: AVPlaybackStatus) => void) | null) => void;
};

const native =
  Platform.OS === 'ios' ? requireOptionalNativeModule<LoudPlaybackNative>('LoudPlayback') : null;

function toPlaybackStatus(
  raw: {
    isLoaded: boolean;
    isPlaying: boolean;
    positionMillis: number;
    durationMillis: number;
  },
  didJustFinish = false,
): AVPlaybackStatus {
  if (!raw.isLoaded) {
    return { isLoaded: false };
  }
  return {
    isLoaded: true,
    isPlaying: raw.isPlaying,
    positionMillis: raw.positionMillis,
    durationMillis: raw.durationMillis,
    didJustFinish,
  } as AVPlaybackStatus;
}

export function canUseLoudPlayback() {
  return native != null;
}

export async function createLoudSound(
  uri: string,
  volume: number,
): Promise<SoundLike> {
  if (!native) {
    throw new Error('LoudPlayback is not available');
  }

  await native.load(uri, volume);

  let onStatus: ((status: AVPlaybackStatus) => void) | null = null;
  const emitter = new EventEmitter(native);
    let finished = false;
    const emit = (
      status: {
        isLoaded: boolean;
        isPlaying: boolean;
        positionMillis: number;
        durationMillis: number;
      },
      didJustFinish = false,
    ) => {
      if (didJustFinish) {
        if (finished) return;
        finished = true;
      }
      onStatus?.(toPlaybackStatus(status, didJustFinish));
    };

    const endedSub = emitter.addListener('onEnded', () => {
      void native.getStatus().then((status) => {
        emit({ ...status, isPlaying: false }, true);
      });
    });
    const timer = setInterval(() => {
      if (!onStatus) return;
      void native.getStatus().then((status) => {
        const reachedEnd =
          status.isLoaded &&
          status.durationMillis > 500 &&
          !status.isPlaying &&
          status.positionMillis >= status.durationMillis - 250;
        emit(status, reachedEnd);
      });
    }, 400);

  const stopUpdates = () => {
    endedSub.remove();
    clearInterval(timer);
  };

  return {
    playAsync: () => native.play(),
    pauseAsync: () => native.pause(),
    unloadAsync: async () => {
      stopUpdates();
      await native.unload();
    },
    setVolumeAsync: (next) => native.setVolume(next),
    setPositionAsync: (millis) => native.seek(millis / 1000),
    getStatusAsync: async () => toPlaybackStatus(await native.getStatus()),
    setOnPlaybackStatusUpdate: (callback) => {
      onStatus = callback;
    },
  };
}
