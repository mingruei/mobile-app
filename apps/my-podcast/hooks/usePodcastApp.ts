import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addLocalPlaybackListener,
  parseLocalStatus,
  pauseLocalFile,
  playLocalFile,
  loadLocalFile,
  readLocalStatus,
  resumeLocalFile,
  seekLocalFile,
  stopLocalFile,
} from '../services/localPlayback';

import type { Episode, EpisodeOrder, LibraryData, Show } from '../types/podcast';
import {
  heardDownloadedFilenames,
  libraryAfterHeard,
  libraryAfterUnheard,
  libraryWithoutHeardDownloads,
  missingDownloadIds,
  wantedEpisodeIds,
} from '../utils/autoDownload';
import {
  deleteEpisodeFile,
  downloadEpisodeFile,
  localFileSnapshot,
  localFileUri,
} from '../utils/episodeFiles';
import { loadFeed, searchShows } from '../utils/feedClient';
import { episodeFilename, extensionForEpisode, normalizeFeedUrl } from '../utils/identity';
import type { PodcastSearchHit } from '../utils/itunes';
import {
  applyFeed,
  EMPTY_LIBRARY,
  findEpisode,
  findShowByFeedUrl,
  keptEpisodeIds,
  planPlayback,
  removeShowFromLibrary,
  upsertShow,
} from '../utils/library';
import { LIBRARY_KEY, parseLibrary, serializeLibrary } from '../utils/libraryStorage';
import {
  formatDownloadProgressText,
  type DownloadProgress,
} from '../utils/downloadProgress';
import {
  applyWatchProgress,
  parseWatchProgress,
  parseWatchTransferProgress,
  watchEventMessage,
  watchFailure,
  watchSavedId,
} from '../utils/watchProgress';
import { isWidgetPlayUrl, widgetPlaySelection } from '../utils/widgetPlay';
import {
  addWatchProgressListener,
  prepareLocalPlayback,
  readLatestWatchProgress,
  deleteEpisodeOnWatch,
  sendEpisodeToWatch,
} from '../services/watchTransfer';

export type AppScreen =
  | { name: 'home' }
  | { name: 'add' }
  | { name: 'show'; showId: string }
  | { name: 'player' };

export type PlayerStatus = 'idle' | 'downloading' | 'playing' | 'paused' | 'error';

export type PlayerView = {
  showId: string | null;
  episodeId: string | null;
  status: PlayerStatus;
  message: string;
  positionMillis: number;
  durationMillis: number;
};

const INITIAL_PLAYER: PlayerView = {
  showId: null,
  episodeId: null,
  status: 'idle',
  message: '',
  positionMillis: 0,
  durationMillis: 0,
};

type PlayingEpisode = { showId: string; episodeId: string };

export function usePodcastApp() {
  const libraryRef = useRef<LibraryData>(EMPTY_LIBRARY);
  const writeChain = useRef(Promise.resolve());
  const playingRef = useRef<PlayingEpisode | null>(null);
  const playLock = useRef(false);
  const lastSaveAt = useRef(0);
  const playerRef = useRef<PlayerView>(INITIAL_PLAYER);

  const [ready, setReady] = useState(false);
  const [library, setLibrary] = useState<LibraryData>(EMPTY_LIBRARY);
  const [screen, setScreen] = useState<AppScreen>({ name: 'home' });
  const [player, setPlayer] = useState<PlayerView>(INITIAL_PLAYER);
  const [results, setResults] = useState<PodcastSearchHit[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [watchSending, setWatchSending] = useState(false);
  const [downloadingShows, setDownloadingShows] = useState<Record<string, boolean>>({});
  const [downloadProgressById, setDownloadProgressById] = useState<Record<string, DownloadProgress>>({});
  const [queueNote, setQueueNote] = useState<string | null>(null);
  const watchLock = useRef(false);
  const downloadingIds = useRef(new Set<string>());
  const fillLock = useRef<Record<string, boolean>>({});
  const fillAgain = useRef<Record<string, boolean>>({});
  const watchSizeRetried = useRef(new Set<string>());
  const lastProgressPublishAt = useRef<Record<string, number>>({});
  const lastProgressPercent = useRef<Record<string, number>>({});
  const markHeardRef = useRef<
    (episodeId: string, reason?: 'finish' | 'manual' | 'watch') => Promise<void>
  >(async () => undefined);
  const fillRef = useRef<(showId: string) => Promise<void>>(async () => undefined);

  const updatePlayer = useCallback((patch: Partial<PlayerView>) => {
    setPlayer((current) => {
      const next = { ...current, ...patch };
      playerRef.current = next;
      return next;
    });
  }, []);

  const clearDownloadProgress = useCallback((episodeId: string) => {
    delete lastProgressPublishAt.current[episodeId];
    delete lastProgressPercent.current[episodeId];
    setDownloadProgressById((current) => {
      if (!(episodeId in current)) return current;
      const next = { ...current };
      delete next[episodeId];
      return next;
    });
  }, []);

  const reportDownloadProgress = useCallback(
    (episodeId: string, progress: DownloadProgress, options?: { updatePlayerMessage?: boolean; updateQueueNote?: boolean }) => {
      const expected = progress.expected && progress.expected > 0 ? progress.expected : null;
      const percent = expected ? Math.min(99, Math.floor((progress.written / expected) * 100)) : -1;
      const now = Date.now();
      const lastAt = lastProgressPublishAt.current[episodeId] ?? 0;
      if (percent >= 0 && lastProgressPercent.current[episodeId] === percent && now - lastAt < 750) {
        return;
      }
      if (percent < 0 && now - lastAt < 750) {
        return;
      }
      lastProgressPublishAt.current[episodeId] = now;
      if (percent >= 0) lastProgressPercent.current[episodeId] = percent;

      const nextProgress: DownloadProgress = {
        written: Math.max(0, progress.written),
        expected,
      };
      const text = formatDownloadProgressText(nextProgress);
      setDownloadProgressById((current) => {
        const previous = current[episodeId];
        if (
          previous &&
          previous.written === nextProgress.written &&
          previous.expected === nextProgress.expected
        ) {
          return current;
        }
        return { ...current, [episodeId]: nextProgress };
      });
      if (options?.updatePlayerMessage && playerRef.current.episodeId === episodeId) {
        updatePlayer({ status: 'downloading', message: text });
      }
      if (options?.updateQueueNote) {
        setQueueNote(text);
      }
    },
    [updatePlayer],
  );

  const commit = useCallback((recipe: (current: LibraryData) => LibraryData) => {
    const next = recipe(libraryRef.current);
    libraryRef.current = next;
    setLibrary(next);
    const payload = serializeLibrary(next);
    writeChain.current = writeChain.current
      .then(() => AsyncStorage.setItem(LIBRARY_KEY, payload))
      .catch(() => undefined);
  }, []);

  const remember = useCallback(
    (positionMillis: number, durationMillis: number | null, completed: boolean) => {
      const current = playingRef.current;
      if (!current) return;
      commit((latest) => {
        const previous = latest.progressByEpisode[current.episodeId];
        const duration = durationMillis ?? previous?.durationMillis ?? null;
        const nearEnd = duration != null && duration > 0 && positionMillis >= duration - 1500;
        return {
          ...latest,
          progressByEpisode: {
            ...latest.progressByEpisode,
            [current.episodeId]: {
              positionMillis,
              durationMillis: duration,
              updatedAt: new Date().toISOString(),
              completed: completed || (previous?.completed === true && nearEnd),
            },
          },
        };
      });
    },
    [commit],
  );

  const unloadSound = useCallback(() => {
    stopLocalFile();
  }, []);

  const rememberFilename = useCallback(
    (episodeId: string, filename: string | undefined) => {
      if (!filename) return;
      commit((latest) => {
        const stored = latest.filesByEpisode[episodeId];
        if (!stored || stored.filename === filename) return latest;
        return {
          ...latest,
          filesByEpisode: {
            ...latest.filesByEpisode,
            [episodeId]: { ...stored, filename },
          },
        };
      });
    },
    [commit],
  );

  const presentFile = useCallback(
    async (uri: string, positionMillis: number, showId: string, episodeId: string, autoplay: boolean) => {
      await prepareLocalPlayback(uri);
      playingRef.current = { showId, episodeId };
      const found = findEpisode(libraryRef.current, episodeId);
      const title = found?.episode.title ?? '';
      const showTitle = found?.show.title ?? '';
      const status = autoplay
        ? await playLocalFile(uri, positionMillis, title, showTitle)
        : await loadLocalFile(uri, positionMillis, title, showTitle);
      rememberFilename(episodeId, status.filename);
      const start = status.positionMillis;
      updatePlayer({
        showId,
        episodeId,
        status: autoplay ? 'playing' : 'paused',
        message: autoplay
          ? start > 1000
            ? '從上次的地方接著聽'
            : '從手機裡的音檔播放'
          : start > 1000
            ? '停在上次的地方。按播放接著聽。'
            : '按播放開始聽。',
        positionMillis: start,
        durationMillis: status.durationMillis,
      });
      lastSaveAt.current = Date.now();
      return true;
    },
    [rememberFilename, updatePlayer],
  );

  const forgetFile = useCallback(
    (episodeId: string, filename: string | undefined) => {
      if (filename) deleteEpisodeFile(filename);
      commit((latest) => {
        if (!latest.filesByEpisode[episodeId]) return latest;
        const filesByEpisode = { ...latest.filesByEpisode };
        delete filesByEpisode[episodeId];
        return { ...latest, filesByEpisode };
      });
    },
    [commit],
  );

  const queueDownloadedEpisodeOnWatch = useCallback((episodeId: string) => {
    const found = findEpisode(libraryRef.current, episodeId);
    const stored = libraryRef.current.filesByEpisode[episodeId];
    const uri = stored ? localFileUri(stored.filename) : null;
    if (!found || !uri) return;
    const positionMillis = libraryRef.current.progressByEpisode[episodeId]?.positionMillis ?? 0;
    void sendEpisodeToWatch({
      uri,
      episodeId: found.episode.id,
      title: found.episode.title,
      showTitle: found.show.title,
      positionMillis,
      startPlayback: false,
      publishedAt: found.episode.publishedAt,
      episodeOrder: found.show.episodeOrder,
    }).catch(() => undefined);
  }, []);

  const playEpisode = useCallback(
    async (showId: string, episodeId: string, autoplay = false) => {
      if (playLock.current) return;
      if (!autoplay && playingRef.current?.episodeId === episodeId) {
        const currentStatus = readLocalStatus();
        if (currentStatus && currentStatus.durationMillis > 0) {
          setScreen({ name: 'player' });
          updatePlayer({
            showId,
            episodeId,
            status: currentStatus.playing ? 'playing' : 'paused',
            positionMillis: currentStatus.positionMillis,
            durationMillis: currentStatus.durationMillis,
          });
          return;
        }
      }
      playLock.current = true;
      setScreen({ name: 'player' });
      try {
        const found = findEpisode(libraryRef.current, episodeId);
        if (!found || found.show.id !== showId) {
          updatePlayer({ status: 'error', message: '找不到這一集', showId, episodeId });
          return;
        }

        playingRef.current = { showId, episodeId };
        const progress = libraryRef.current.progressByEpisode[episodeId] ?? null;
        const stored = libraryRef.current.filesByEpisode[episodeId] ?? null;
        const snapshot = stored ? localFileSnapshot(stored.filename) : { exists: false, bytes: 0 };
        const plan = planPlayback({
          fileExists: snapshot.exists,
          fileBytes: snapshot.bytes,
          expectedBytes: found.episode.expectedBytes,
          savedBytes: stored?.bytes ?? null,
          progress,
          episodeDurationMillis: found.episode.durationMillis,
        });

        const uri = stored ? localFileUri(stored.filename) : null;
        if (uri) {
          try {
            await presentFile(uri, plan.positionMillis, showId, episodeId, autoplay);
          } catch (error) {
            const detail = error instanceof Error ? error.message : '';
            updatePlayer({
              showId,
              episodeId,
              status: 'error',
              message: detail ? `無法播放：${detail}` : '無法播放。',
              positionMillis: plan.positionMillis,
              durationMillis: found.episode.durationMillis ?? 0,
            });
          }
          return;
        }

        updatePlayer({
          showId,
          episodeId,
          status: 'downloading',
          message: autoplay
            ? '正在把整集存進手機。可鎖定螢幕，下載會在背景繼續；存完才播放。'
            : '正在把整集存進手機。可鎖定螢幕，下載會在背景繼續。',
          positionMillis: plan.positionMillis,
          durationMillis: found.episode.durationMillis ?? 0,
        });

        let source: Episode = found.episode;
        try {
          const parsed = await loadFeed(found.show.feedUrl);
          const updated = applyFeed(
            found.show,
            parsed,
            found.show.feedUrl,
            new Date().toISOString(),
            keptEpisodeIds(libraryRef.current, found.show),
          );
          commit((latest) => upsertShow(latest, updated));
          source = updated.episodes.find((episode) => episode.id === episodeId) ?? found.episode;
        } catch {
          source = found.episode;
        }

        const filename = episodeFilename(
          source.id,
          extensionForEpisode(source.enclosureType, source.enclosureUrl),
        );
        if (downloadingIds.current.has(episodeId)) {
          updatePlayer({ status: 'downloading', message: '這一集正在下載。' });
          const started = Date.now();
          while (downloadingIds.current.has(episodeId) && Date.now() - started < 180_000) {
            await new Promise((resolve) => setTimeout(resolve, 400));
          }
          const ready = libraryRef.current.filesByEpisode[episodeId];
          const readyUri = ready ? localFileUri(ready.filename) : null;
          if (readyUri) {
            try {
              await presentFile(readyUri, plan.positionMillis, showId, episodeId, autoplay);
              return;
            } catch (error) {
              const detail = error instanceof Error ? error.message : '';
              updatePlayer({
                status: 'error',
                message: detail ? `無法播放：${detail}` : '無法播放。',
              });
              return;
            }
          }
        }
        downloadingIds.current.add(episodeId);
        try {
          const saved = await downloadEpisodeFile({
            url: source.enclosureUrl,
            filename,
            expectedBytes: source.expectedBytes,
            onProgress: (progress) => {
              reportDownloadProgress(episodeId, progress, { updatePlayerMessage: true });
            },
          });
          if (libraryRef.current.progressByEpisode[episodeId]?.completed === true) {
            deleteEpisodeFile(saved.filename);
            updatePlayer({ status: 'paused', message: '已標成已聽過。' });
            return;
          }
          commit((latest) => ({
            ...latest,
            filesByEpisode: {
              ...latest.filesByEpisode,
              [episodeId]: {
                filename: saved.filename,
                bytes: saved.bytes,
                downloadedAt: new Date().toISOString(),
              },
            },
          }));
          queueDownloadedEpisodeOnWatch(episodeId);
          try {
            await presentFile(saved.uri, plan.positionMillis, showId, episodeId, autoplay);
          } catch (error) {
            const detail = error instanceof Error ? error.message : '';
            updatePlayer({
              status: 'error',
              message: detail ? `無法播放：${detail}` : '無法播放。',
            });
          }
        } catch {
          updatePlayer({
            status: 'error',
            message: '下載沒有完成。請連上網路後再按一次播放。',
          });
        } finally {
          downloadingIds.current.delete(episodeId);
          clearDownloadProgress(episodeId);
        }
      } finally {
        playLock.current = false;
      }
    },
    [
      clearDownloadProgress,
      commit,
      forgetFile,
      presentFile,
      queueDownloadedEpisodeOnWatch,
      reportDownloadProgress,
      unloadSound,
      updatePlayer,
    ],
  );

  const playFromWidget = useCallback(async () => {
    const live = readLocalStatus();
    const current = playingRef.current;
    const view = playerRef.current;
    if (current && live?.playing) {
      updatePlayer({
        status: 'playing',
        positionMillis: live.positionMillis,
        durationMillis: live.durationMillis,
      });
      setScreen({ name: 'player' });
      return;
    }
    if (view.status === 'playing' && current) {
      await playEpisode(current.showId, current.episodeId, true);
      return;
    }
    const target = widgetPlaySelection(libraryRef.current, {
      status: view.status,
      showId: current?.showId ?? view.showId,
      episodeId: current?.episodeId ?? view.episodeId,
    });
    if (!target) return;
    if (current?.episodeId === target.episodeId && live && live.durationMillis > 0 && !live.playing) {
      try {
        const started = resumeLocalFile();
        updatePlayer({
          showId: target.showId,
          episodeId: target.episodeId,
          status: 'playing',
          message: '從手機裡的音檔播放',
          positionMillis: started.positionMillis,
          durationMillis: started.durationMillis,
        });
        setScreen({ name: 'player' });
        return;
      } catch {
        // The loaded file cannot resume. Open it again below.
      }
    }
    await playEpisode(target.showId, target.episodeId, true);
  }, [playEpisode, updatePlayer]);

  const playFromWidgetRef = useRef(playFromWidget);
  playFromWidgetRef.current = playFromWidget;
  const widgetReadyRef = useRef(ready);
  widgetReadyRef.current = ready;
  const pendingWidgetUrl = useRef<string | null>(null);
  const lastWidgetPlayAt = useRef(0);

  const handleWidgetUrl = useCallback((url: string | null) => {
    if (!isWidgetPlayUrl(url)) return;
    if (!widgetReadyRef.current) {
      pendingWidgetUrl.current = url;
      return;
    }
    const now = Date.now();
    if (now - lastWidgetPlayAt.current < 2000) return;
    lastWidgetPlayAt.current = now;
    pendingWidgetUrl.current = null;
    void playFromWidgetRef.current();
  }, []);

  useEffect(() => {
    if (!ready || !pendingWidgetUrl.current) return;
    handleWidgetUrl(pendingWidgetUrl.current);
  }, [ready, handleWidgetUrl]);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      handleWidgetUrl(event.url);
    });
    Linking.getInitialURL()
      .then((url) => handleWidgetUrl(url))
      .catch(() => undefined);
    return () => subscription.remove();
  }, [handleWidgetUrl]);

  useEffect(() => {
    void (async () => {
      const raw = await AsyncStorage.getItem(LIBRARY_KEY);
      const parsed = parseLibrary(raw);
      const cleaned = libraryWithoutHeardDownloads(parsed);
      for (const filename of heardDownloadedFilenames(parsed)) deleteEpisodeFile(filename);
      libraryRef.current = cleaned;
      setLibrary(cleaned);
      if (cleaned !== parsed) {
        const payload = serializeLibrary(cleaned);
        writeChain.current = writeChain.current
          .then(() => AsyncStorage.setItem(LIBRARY_KEY, payload))
          .catch(() => undefined);
      }
      setReady(true);
      for (const show of cleaned.shows) {
        await fillRef.current(show.id);
      }
    })();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') return;
      const status = readLocalStatus();
      if (!status || status.durationMillis <= 0) return;
      remember(status.positionMillis, status.durationMillis, false);
    });
    return () => {
      subscription.remove();
      unloadSound();
    };
  }, [remember, unloadSound]);

  useEffect(() => {
    const subscription = addLocalPlaybackListener((payload) => {
      const status = parseLocalStatus(payload);
      const current = playingRef.current;
      if (!status || !current) return;
      if (status.finished && status.durationMillis >= 30_000) {
        updatePlayer({
          status: 'paused',
          positionMillis: status.positionMillis,
          durationMillis: status.durationMillis,
          message: '這一集聽完了',
        });
        void markHeardRef.current(current.episodeId, 'finish');
        return;
      }
      if (!status.playing) {
        updatePlayer({
          status: 'paused',
          positionMillis: status.positionMillis,
          durationMillis: status.durationMillis,
        });
        return;
      }
      updatePlayer({
        status: 'playing',
        positionMillis: status.positionMillis,
        durationMillis: status.durationMillis,
      });
      const now = Date.now();
      if (now - lastSaveAt.current > 5000) {
        lastSaveAt.current = now;
        remember(status.positionMillis, status.durationMillis, false);
      }
    });
    return () => subscription.remove();
  }, [remember, updatePlayer]);

  useEffect(() => {
    const accept = (payload: unknown) => {
      const savedId = watchSavedId(payload);
      if (savedId) {
        clearDownloadProgress(savedId);
        updatePlayer({ message: '手表已收下這一集。打開手表上的「奧笛流」就能看到。' });
        return;
      }
      const transfer = parseWatchTransferProgress(payload);
      if (transfer) {
        if (playerRef.current.episodeId === transfer.episodeId || watchLock.current) {
          const message =
            transfer.written <= 0
              ? '正在傳到手表…'
              : formatDownloadProgressText({
                  written: transfer.written,
                  expected: transfer.expected,
                }).replace(/^下載/, '傳到手表');
          updatePlayer({ message });
        }
        return;
      }
      const failure = watchFailure(payload);
      if (failure) {
        if (failure.episodeId) clearDownloadProgress(failure.episodeId);
        if (
          failure.code === 'watch-size' &&
          failure.episodeId &&
          !watchSizeRetried.current.has(failure.episodeId)
        ) {
          watchSizeRetried.current.add(failure.episodeId);
          updatePlayer({ message: '手表收到的音檔大小不對，正在再傳一次。' });
          queueDownloadedEpisodeOnWatch(failure.episodeId);
          return;
        }
        const notice = watchEventMessage(payload);
        if (notice) updatePlayer({ message: notice });
        return;
      }
      const report = parseWatchProgress(payload);
      if (!report) return;
      if (
        !report.completed &&
        playingRef.current?.episodeId === report.episodeId &&
        playerRef.current.status === 'playing'
      ) {
        return;
      }
      commit((latest) => applyWatchProgress(latest, report, new Date().toISOString()));
      if (report.completed) {
        void markHeardRef.current(report.episodeId, 'watch');
        return;
      }
      if (playingRef.current?.episodeId === report.episodeId) {
        updatePlayer({
          positionMillis: report.positionMillis,
          durationMillis: report.durationMillis ?? playerRef.current.durationMillis,
          message: '手表上的進度已記回來',
        });
      }
    };
    const subscription = addWatchProgressListener(accept);
    accept(readLatestWatchProgress());
    return () => subscription.remove();
  }, [clearDownloadProgress, commit, queueDownloadedEpisodeOnWatch, updatePlayer]);

  const search = useCallback(async (term: string) => {
    const query = term.trim();
    if (!query) {
      setAddError('請輸入節目名稱');
      return;
    }
    setSearchBusy(true);
    setAddError(null);
    try {
      const hits = await searchShows(query);
      setResults(hits);
      if (hits.length === 0) setAddError('找不到節目');
    } catch {
      setResults([]);
      setAddError('搜尋失敗，請稍後再試');
    } finally {
      setSearchBusy(false);
    }
  }, []);

  const setShowDownloading = useCallback((showId: string, active: boolean) => {
    setDownloadingShows((current) => {
      if (active) return current[showId] ? current : { ...current, [showId]: true };
      if (!current[showId]) return current;
      const next = { ...current };
      delete next[showId];
      return next;
    });
  }, []);

  const storeEpisodeFile = useCallback(
    async (episode: Episode): Promise<'saved' | 'skipped' | 'failed'> => {
      if (libraryRef.current.progressByEpisode[episode.id]?.completed === true) return 'skipped';
      if (libraryRef.current.filesByEpisode[episode.id]) return 'skipped';
      const filename = episodeFilename(episode.id, extensionForEpisode(episode.enclosureType, episode.enclosureUrl));
      try {
        const saved = await downloadEpisodeFile({
          url: episode.enclosureUrl,
          filename,
          expectedBytes: episode.expectedBytes,
          onProgress: (progress) => {
            reportDownloadProgress(episode.id, progress, {
              updatePlayerMessage: playerRef.current.episodeId === episode.id,
            });
          },
        });
        let discard = false;
        commit((latest) => {
          if (latest.progressByEpisode[episode.id]?.completed === true) {
            discard = true;
            return latest;
          }
          if (latest.filesByEpisode[episode.id]) return latest;
          const show = latest.shows.find((item) => item.episodes.some((itemEpisode) => itemEpisode.id === episode.id));
          if (
            show &&
            !wantedEpisodeIds(
              show.episodes,
              show.episodeOrder,
              show.autoDownloadCount,
              latest.progressByEpisode,
            ).includes(episode.id)
          ) {
            discard = true;
            return latest;
          }
          return {
            ...latest,
            filesByEpisode: {
              ...latest.filesByEpisode,
              [episode.id]: {
                filename: saved.filename,
                bytes: saved.bytes,
                downloadedAt: new Date().toISOString(),
              },
            },
          };
        });
        if (discard) {
          deleteEpisodeFile(saved.filename);
          return 'skipped';
        }
        queueDownloadedEpisodeOnWatch(episode.id);
        return 'saved';
      } catch {
        return 'failed';
      } finally {
        clearDownloadProgress(episode.id);
      }
    },
    [clearDownloadProgress, commit, queueDownloadedEpisodeOnWatch, reportDownloadProgress],
  );

  const fillAutoDownloads = useCallback(
    async (showId: string) => {
      if (fillLock.current[showId]) {
        fillAgain.current[showId] = true;
        return;
      }
      fillLock.current[showId] = true;
      let failed = false;
      try {
        while (!failed) {
          const show = libraryRef.current.shows.find((item) => item.id === showId);
          if (!show) return;
          const episodeId = missingDownloadIds(
            show,
            libraryRef.current.progressByEpisode,
            libraryRef.current.filesByEpisode,
          ).find((id) => !downloadingIds.current.has(id));
          if (!episodeId) return;
          const episode = show.episodes.find((item) => item.id === episodeId);
          if (!episode) return;
          downloadingIds.current.add(episodeId);
          setShowDownloading(showId, true);
          try {
            let result = await storeEpisodeFile(episode);
            if (result === 'failed') {
              try {
                const parsed = await loadFeed(show.feedUrl);
                const updated = applyFeed(
                  libraryRef.current.shows.find((item) => item.id === showId) ?? show,
                  parsed,
                  show.feedUrl,
                  new Date().toISOString(),
                  keptEpisodeIds(libraryRef.current, show),
                );
                commit((latest) => upsertShow(latest, updated));
                const fresh = updated.episodes.find((item) => item.id === episodeId);
                result = fresh ? await storeEpisodeFile(fresh) : 'failed';
              } catch {
                result = 'failed';
              }
            }
            if (result === 'failed') {
              failed = true;
              setQueueNote('有一集沒下載到。連上網路後，再按一次更新節目。');
            } else if (result === 'saved') {
              setQueueNote(null);
            } else {
              setQueueNote(null);
            }
          } finally {
            downloadingIds.current.delete(episodeId);
            clearDownloadProgress(episodeId);
          }
        }
      } finally {
        fillLock.current[showId] = false;
        setShowDownloading(showId, false);
        if (fillAgain.current[showId]) {
          fillAgain.current[showId] = false;
          void fillAutoDownloads(showId);
        }
      }
    },
    [clearDownloadProgress, commit, setShowDownloading, storeEpisodeFile],
  );

  const markHeard = useCallback(
    async (episodeId: string, reason: 'finish' | 'manual' | 'watch' = 'manual') => {
      const found = findEpisode(libraryRef.current, episodeId);
      if (!found) return;
      const progress = libraryRef.current.progressByEpisode[episodeId];
      const already = progress?.completed === true && !libraryRef.current.filesByEpisode[episodeId];
      if (!already && playingRef.current?.episodeId === episodeId) {
        playingRef.current = null;
        await unloadSound();
        updatePlayer({
          status: 'paused',
          positionMillis: 0,
          message:
            reason === 'finish'
              ? '這一集聽完了。音檔已刪掉，正在下載下一集。'
              : reason === 'watch'
                ? '手表聽完了。音檔已刪掉，正在下載下一集。'
                : '已標成已聽過。音檔已刪掉。',
        });
      }
      if (!already) {
        const filename = libraryRef.current.filesByEpisode[episodeId]?.filename;
        if (filename) deleteEpisodeFile(filename);
        commit((latest) => libraryAfterHeard(latest, episodeId, new Date().toISOString()).library);
        if (reason !== 'watch') deleteEpisodeOnWatch(episodeId);
      }
      void fillAutoDownloads(found.show.id);
    },
    [commit, fillAutoDownloads, unloadSound, updatePlayer],
  );

  const markUnheard = useCallback(
    (episodeId: string) => {
      const found = findEpisode(libraryRef.current, episodeId);
      if (!found) return;
      commit((latest) => libraryAfterUnheard(latest, episodeId, new Date().toISOString()));
      void fillAutoDownloads(found.show.id);
    },
    [commit, fillAutoDownloads],
  );

  const setEpisodeOrder = useCallback(
    (showId: string, episodeOrder: EpisodeOrder) => {
      commit((latest) => ({
        ...latest,
        shows: latest.shows.map((show) => (show.id === showId ? { ...show, episodeOrder } : show)),
      }));
      setQueueNote(null);
      void fillAutoDownloads(showId);
    },
    [commit, fillAutoDownloads],
  );

  const setAutoDownloadCount = useCallback(
    (showId: string, count: number) => {
      commit((latest) => ({
        ...latest,
        shows: latest.shows.map((show) =>
          show.id === showId ? { ...show, autoDownloadCount: Math.max(0, Math.min(20, Math.floor(count))) } : show,
        ),
      }));
      setQueueNote(null);
      void fillAutoDownloads(showId);
    },
    [commit, fillAutoDownloads],
  );

  fillRef.current = fillAutoDownloads;
  markHeardRef.current = markHeard;

  const addFeed = useCallback(
    async (rawUrl: string) => {
      const feedUrl = normalizeFeedUrl(rawUrl);
      if (!feedUrl) {
        setAddError('請貼上 http 開頭的節目網址');
        return;
      }
      const existing = findShowByFeedUrl(libraryRef.current, feedUrl);
      if (existing) {
        setScreen({ name: 'show', showId: existing.id });
        void fillAutoDownloads(existing.id);
        return;
      }
      setAddBusy(true);
      setAddError(null);
      try {
        const parsed = await loadFeed(feedUrl);
        const show = applyFeed(null, parsed, feedUrl, new Date().toISOString(), []);
        commit((latest) => upsertShow(latest, show));
        setScreen({ name: 'show', showId: show.id });
        void fillAutoDownloads(show.id);
      } catch {
        setAddError('沒有抓到節目。請確認這是 RSS 網址，或稍後再試。');
      } finally {
        setAddBusy(false);
      }
    },
    [commit, fillAutoDownloads],
  );

  const refreshShow = useCallback(
    async (showId: string) => {
      const show = libraryRef.current.shows.find((item) => item.id === showId);
      if (!show) return;
      setRefreshingId(showId);
      setRefreshError(null);
      try {
        const parsed = await loadFeed(show.feedUrl);
        const updated = applyFeed(
          show,
          parsed,
          show.feedUrl,
          new Date().toISOString(),
          keptEpisodeIds(libraryRef.current, show),
        );
        commit((latest) => upsertShow(latest, updated));
        setQueueNote(null);
      } catch {
        setRefreshError('更新失敗。先用上次的單集清單。');
      } finally {
        setRefreshingId(null);
        void fillAutoDownloads(showId);
      }
    },
    [commit, fillAutoDownloads],
  );

  const deleteShow = useCallback(
    async (showId: string) => {
      const playingId = playingRef.current?.episodeId;
      const removed = removeShowFromLibrary(libraryRef.current, showId);
      if (playingId && removed.episodeIds.includes(playingId)) {
        playingRef.current = null;
        await unloadSound();
        updatePlayer(INITIAL_PLAYER);
      }
      for (const filename of removed.filenames) deleteEpisodeFile(filename);
      commit(() => removed.library);
      setScreen({ name: 'home' });
    },
    [commit, unloadSound, updatePlayer],
  );

  const removeDownload = useCallback(
    async (episodeId: string) => {
      const filename = libraryRef.current.filesByEpisode[episodeId]?.filename;
      if (playingRef.current?.episodeId === episodeId) {
        await unloadSound();
        updatePlayer({ status: 'paused', message: '已刪掉手機上的音檔' });
      }
      forgetFile(episodeId, filename);
    },
    [forgetFile, unloadSound, updatePlayer],
  );

  const togglePlayback = useCallback(async () => {
    if (playerRef.current.status === 'downloading') return;
    const current = playingRef.current;
    const status = readLocalStatus();
    if (current && status && status.durationMillis > 0) {
      try {
        if (status.playing) {
          const paused = pauseLocalFile();
          remember(paused.positionMillis, paused.durationMillis, false);
          updatePlayer({ status: 'paused', positionMillis: paused.positionMillis, durationMillis: paused.durationMillis });
        } else {
          const started = resumeLocalFile();
          updatePlayer({
            status: 'playing',
            message: '從手機裡的音檔播放',
            positionMillis: started.positionMillis,
            durationMillis: started.durationMillis,
          });
        }
        return;
      } catch {
        // The open player cannot resume. Open the saved file again.
      }
    }
    if (current) await playEpisode(current.showId, current.episodeId, true);
  }, [playEpisode, remember, updatePlayer]);

  const seekBy = useCallback(
    (deltaMillis: number) => {
      const status = readLocalStatus();
      if (!status || status.durationMillis <= 0) return;
      const next = Math.max(0, status.positionMillis + deltaMillis);
      const clamped = Math.min(next, Math.max(0, status.durationMillis - 500));
      const moved = seekLocalFile(clamped);
      updatePlayer({ positionMillis: moved.positionMillis, durationMillis: moved.durationMillis });
      remember(moved.positionMillis, moved.durationMillis, false);
    },
    [remember, updatePlayer],
  );

  const seekToRatio = useCallback(
    (ratio: number) => {
      const status = readLocalStatus();
      if (!status || status.durationMillis <= 0) return;
      const next = Math.max(0, Math.min(status.durationMillis - 500, Math.floor(status.durationMillis * ratio)));
      const moved = seekLocalFile(next);
      updatePlayer({ positionMillis: moved.positionMillis, durationMillis: moved.durationMillis });
      remember(moved.positionMillis, moved.durationMillis, false);
    },
    [remember, updatePlayer],
  );

  const sendToWatch = useCallback(async () => {
    if (watchLock.current) return;
    const current = playingRef.current;
    if (!current) return;
    const found = findEpisode(libraryRef.current, current.episodeId);
    const stored = libraryRef.current.filesByEpisode[current.episodeId];
    const uri = stored ? localFileUri(stored.filename) : null;
    if (!found || !uri) {
      updatePlayer({ message: '要先把這一集存進手機，才能傳到手表。' });
      return;
    }

    watchLock.current = true;
    setWatchSending(true);
    try {
      const status = readLocalStatus();
      if (status?.playing) {
        const paused = pauseLocalFile();
        remember(paused.positionMillis, paused.durationMillis, false);
      }
      await sendEpisodeToWatch({
        uri,
        episodeId: found.episode.id,
        title: found.episode.title,
        showTitle: found.show.title,
        positionMillis: playerRef.current.positionMillis,
        startPlayback: true,
        publishedAt: found.episode.publishedAt,
        episodeOrder: found.show.episodeOrder,
      });
      updatePlayer({ message: '正在傳到手表…' });
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : '沒有傳到手表。';
      updatePlayer({ message });
    } finally {
      watchLock.current = false;
      setWatchSending(false);
    }
  }, [remember, updatePlayer]);

  return {
    ready,
    library,
    screen,
    player,
    results,
    searchBusy,
    addBusy,
    addError,
    refreshingId,
    setScreen,
    search,
    addFeed,
    refreshShow,
    deleteShow,
    playEpisode,
    togglePlayback,
    seekBy,
    seekToRatio,
    removeDownload,
    sendToWatch,
    watchSending,
    refreshError,
    downloadingShows,
    downloadProgressById,
    queueNote,
    markHeard,
    markUnheard,
    setEpisodeOrder,
    setAutoDownloadCount,
    clearAddError: () => setAddError(null),
  };
}

export function showOnScreen(library: LibraryData, screen: AppScreen): Show | null {
  if (screen.name !== 'show') return null;
  return library.shows.find((show) => show.id === screen.showId) ?? null;
}
