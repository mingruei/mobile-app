import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Audio, Video, type AVPlaybackStatus } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import {
  DEFAULT_VOLUME,
  SAVE_INTERVAL_MS,
  STORAGE_KEY,
  clampPlaybackTime,
  clampVolume,
  findResumeIndex,
  nextIndex,
  parseSavedState,
  prevIndex,
  serializeState,
  shouldUseVideoPlayer,
  stepVolume,
} from '../public/player-logic.mjs';
import {
  ingestExternalFile,
  ingestInbox,
  listDeviceTracks,
  type Track,
} from './musicFiles';
import { exitApp } from './exitApp';
import { canUseLoudPlayback, createLoudSound, type SoundLike } from './loudPlayback';
import { isTabletDevice } from './device';

type PlayerView = {
  tracks: Track[];
  index: number;
  current: Track | null;
  position: number;
  duration: number;
  volume: number;
  status: string;
  needsStart: boolean;
  playing: boolean;
  showVideo: boolean;
  videoUri: string | null;
};

function bindVideoSound(getVideo: () => Video | null): SoundLike {
  return {
    playAsync: () => getVideo()?.playAsync() ?? Promise.resolve(),
    pauseAsync: () => getVideo()?.pauseAsync() ?? Promise.resolve(),
    unloadAsync: () => getVideo()?.unloadAsync() ?? Promise.resolve(),
    setVolumeAsync: (volume) => getVideo()?.setVolumeAsync(volume) ?? Promise.resolve(),
    setPositionAsync: (millis) => getVideo()?.setPositionAsync(millis) ?? Promise.resolve(),
    getStatusAsync: () =>
      getVideo()?.getStatusAsync() ?? Promise.resolve({ isLoaded: false } as AVPlaybackStatus),
    setOnPlaybackStatusUpdate: (callback) => {
      getVideo()?.setOnPlaybackStatusUpdate(callback);
    },
  };
}

export function useMusicPlayer() {
  const soundRef = useRef<SoundLike | null>(null);
  const videoRef = useRef<Video>(null);
  const videoReadyRef = useRef(false);
  const videoSeekRef = useRef(0);
  const autoplayRef = useRef(true);
  const tracksRef = useRef<Track[]>([]);
  const indexRef = useRef(0);
  const volumeRef = useRef(DEFAULT_VOLUME);
  const closedRef = useRef(false);
  const resumeTimeRef = useRef(0);
  const loadingRef = useRef(false);
  const playRef = useRef<() => Promise<void>>(async () => undefined);

  const [view, setView] = useState<PlayerView>({
    tracks: [],
    index: 0,
    current: null,
    position: 0,
    duration: 0,
    volume: DEFAULT_VOLUME,
    status: '打開就會接著播放',
    needsStart: false,
    playing: false,
    showVideo: false,
    videoUri: null,
  });

  const publish = useCallback((patch: Partial<PlayerView> = {}) => {
    const tracks = tracksRef.current;
    const index = indexRef.current;
    setView((prev) => ({
      ...prev,
      tracks,
      index,
      current: tracks[index] ?? null,
      volume: volumeRef.current,
      ...patch,
    }));
  }, []);

  const persist = useCallback(async (playing: boolean) => {
    const track = tracksRef.current[indexRef.current];
    const sound = soundRef.current;
    let time = resumeTimeRef.current;
    if (sound) {
      const status = await sound.getStatusAsync();
      if (status.isLoaded) time = status.positionMillis / 1000;
    }
    await AsyncStorage.setItem(
      STORAGE_KEY,
      serializeState({
        file: track?.name ?? null,
        time,
        volume: volumeRef.current,
        playing: closedRef.current ? false : playing,
      }),
    );
  }, []);

  const unload = useCallback(async () => {
    const sound = soundRef.current;
    soundRef.current = null;
    videoReadyRef.current = false;
    if (sound) {
      sound.setOnPlaybackStatusUpdate(null);
      await sound.unloadAsync().catch(() => undefined);
    }
    publish({ showVideo: false, videoUri: null });
  }, [publish]);

  const loadTrack = useCallback(
    async ({
      index,
      time = 0,
      autoplay = true,
    }: {
      index: number;
      time?: number;
      autoplay?: boolean;
    }) => {
      const tracks = tracksRef.current;
      if (!tracks.length) {
        await unload();
        publish({ position: 0, duration: 0, playing: false, status: '還沒有歌曲' });
        return;
      }

      loadingRef.current = true;
      indexRef.current = ((index % tracks.length) + tracks.length) % tracks.length;
      const track = tracks[indexRef.current];
      resumeTimeRef.current = time;
      autoplayRef.current = autoplay;
      videoReadyRef.current = false;
      videoSeekRef.current = time;
      await unload();

      const useVideo = shouldUseVideoPlayer(track.name, isTabletDevice());
      if (useVideo) {
        soundRef.current = bindVideoSound(() => videoRef.current);
        publish({
          showVideo: true,
          videoUri: track.uri,
          position: time,
          needsStart: false,
        });
        loadingRef.current = false;
        return;
      }

      let sound: SoundLike | null = null;
      if (canUseLoudPlayback()) {
        try {
          sound = await createLoudSound(track.uri, clampVolume(volumeRef.current));
        } catch {
          sound = null;
        }
      }
      if (!sound) {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        const created = await Audio.Sound.createAsync(
          { uri: track.uri },
          {
            volume: clampVolume(volumeRef.current),
            shouldPlay: false,
            progressUpdateIntervalMillis: 400,
          },
        );
        sound = created.sound;
      }

      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (!status.isLoaded) return;
        resumeTimeRef.current = status.positionMillis / 1000;
        publish({
          position: status.positionMillis / 1000,
          duration: (status.durationMillis ?? 0) / 1000,
          playing: status.isPlaying,
          status: '正在播放',
        });
        if (status.didJustFinish) {
          void loadTrack({
            index: nextIndex(indexRef.current, tracksRef.current.length),
            time: 0,
            autoplay: true,
          });
        }
      });

      const loaded = await sound.getStatusAsync();
      if (loaded.isLoaded) {
        const startAt = clampPlaybackTime(time, (loaded.durationMillis ?? 0) / 1000);
        await sound.setPositionAsync(startAt * 1000);
        resumeTimeRef.current = startAt;
      }

      publish({
        position: resumeTimeRef.current,
        needsStart: false,
      });
      loadingRef.current = false;

      if (autoplay && !closedRef.current) {
        try {
          await sound.playAsync();
          await activateKeepAwakeAsync('bigplayer');
          publish({ playing: true, status: '正在播放', needsStart: false });
        } catch {
          publish({ needsStart: true, status: '請按「開始播放」' });
        }
      }
    },
    [publish, unload],
  );

  const onVideoStatus = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded) return;

      if (!videoReadyRef.current) {
        videoReadyRef.current = true;
        void (async () => {
          const video = videoRef.current;
          if (!video) return;
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
          await video.setVolumeAsync(clampVolume(volumeRef.current));
          const startAt = clampPlaybackTime(
            videoSeekRef.current,
            (status.durationMillis ?? 0) / 1000,
          );
          await video.setPositionAsync(startAt * 1000);
          resumeTimeRef.current = startAt;
          if (autoplayRef.current && !closedRef.current) {
            try {
              await video.playAsync();
              await activateKeepAwakeAsync('bigplayer');
              publish({ playing: true, status: '正在播放', needsStart: false });
            } catch {
              publish({ needsStart: true, status: '請按「開始播放」' });
            }
          }
        })();
        return;
      }

      resumeTimeRef.current = status.positionMillis / 1000;
      publish({
        position: status.positionMillis / 1000,
        duration: (status.durationMillis ?? 0) / 1000,
        playing: status.isPlaying,
        status: '正在播放',
      });
      if (status.didJustFinish) {
        void loadTrack({
          index: nextIndex(indexRef.current, tracksRef.current.length),
          time: 0,
          autoplay: true,
        });
      }
    },
    [loadTrack, publish],
  );

  const go = useCallback(
    async (index: number) => {
      await loadTrack({ index, time: 0, autoplay: true });
    },
    [loadTrack],
  );

  const refresh = useCallback(
    async ({ preserve }: { preserve: boolean }) => {
      await ingestInbox();
      const previousName = tracksRef.current[indexRef.current]?.name;
      const tracks = await listDeviceTracks();
      tracksRef.current = tracks;

      if (!tracks.length) {
        await unload();
        publish({ position: 0, duration: 0, playing: false, status: '還沒有歌曲' });
        return;
      }

      if (preserve && previousName) {
        const index = findResumeIndex(tracks, previousName);
        if (tracks[index]?.name === previousName) {
          indexRef.current = index;
          publish();
          return;
        }
      }

      const saved = parseSavedState(await AsyncStorage.getItem(STORAGE_KEY));
      volumeRef.current = saved?.volume ?? DEFAULT_VOLUME;
      const index = findResumeIndex(tracks, saved?.file ?? null);
      await loadTrack({
        index,
        time: tracks[index]?.name === saved?.file ? saved?.time ?? 0 : 0,
        autoplay: true,
      });
    },
    [loadTrack, publish, unload],
  );

  const play = useCallback(async () => {
    if (!tracksRef.current.length) {
      publish({ status: '還沒有歌曲' });
      return;
    }
    closedRef.current = false;
    const sound = soundRef.current;
    if (!sound) {
      await refresh({ preserve: false });
      return;
    }
    try {
      await sound.playAsync();
    } catch {
      await refresh({ preserve: false });
      return;
    }
    await activateKeepAwakeAsync('bigplayer');
    publish({ playing: true, status: '正在播放', needsStart: false });
    await persist(true);
  }, [persist, publish, refresh]);
  playRef.current = play;

  const closePlayer = useCallback(async () => {
    closedRef.current = true;
    await persist(false);
    await unload();
    void deactivateKeepAwake('bigplayer');
    exitApp();
  }, [persist, unload]);

  const changeVolume = useCallback(
    async (direction: 1 | -1) => {
      volumeRef.current = stepVolume(volumeRef.current, direction);
      const sound = soundRef.current;
      if (sound) {
        await sound.setVolumeAsync(volumeRef.current);
      }
      publish({ volume: volumeRef.current });
      await persist(!closedRef.current);
    },
    [persist, publish],
  );

  useEffect(() => {
    void (async () => {
      const saved = parseSavedState(await AsyncStorage.getItem(STORAGE_KEY));
      volumeRef.current = saved?.volume ?? DEFAULT_VOLUME;
      await refresh({ preserve: false });
    })();

    const incoming = (url: string | null) => {
      if (!url || !(url.startsWith('file:') || url.startsWith('content:'))) return;
      void ingestExternalFile(url)
        .then(() => refresh({ preserve: true }))
        .catch(() => publish({ status: '無法加入這首歌' }));
    };

    void Linking.getInitialURL().then(incoming);
    const linkSub = Linking.addEventListener('url', ({ url }) => incoming(url));
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        closedRef.current = false;
        void refresh({ preserve: true }).then(() => playRef.current());
        return;
      }
      void persist(false);
      void soundRef.current?.pauseAsync();
      void deactivateKeepAwake('bigplayer');
    });
    const timer = setInterval(() => {
      void (async () => {
        const sound = soundRef.current;
        if (!sound) return;
        const status = await sound.getStatusAsync();
        await persist(status.isLoaded && status.isPlaying);
      })();
    }, SAVE_INTERVAL_MS);

    return () => {
      linkSub.remove();
      appSub.remove();
      clearInterval(timer);
      void unload();
      void deactivateKeepAwake('bigplayer');
    };
  }, [persist, publish, refresh, unload]);

  return {
    ...view,
    play,
    closePlayer,
    next: () => go(nextIndex(indexRef.current, tracksRef.current.length)),
    prev: () => go(prevIndex(indexRef.current, tracksRef.current.length)),
    volumeUp: () => changeVolume(1),
    volumeDown: () => changeVolume(-1),
    videoRef,
    onVideoStatus,
  };
}
