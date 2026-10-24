import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AddShowScreen } from './components/AddShowScreen';
import { HomeScreen } from './components/HomeScreen';
import { MiniPlayer } from './components/MiniPlayer';
import { PlayerScreen } from './components/PlayerScreen';
import { ShowScreen } from './components/ShowScreen';
import { showOnScreen, usePodcastApp } from './hooks/usePodcastApp';
import { sortedEpisodes } from './utils/autoDownload';
import { colors } from './theme';
import { storedEpisodeIsOnDevice } from './utils/episodeFiles';
import { findEpisode, pickContinueListening } from './utils/library';
import { formatDownloadProgressText } from './utils/downloadProgress';
import { formatPlaybackTime } from './utils/media';

export default function App() {
  const podcast = usePodcastApp();
  const [showHeardEpisodes, setShowHeardEpisodes] = useState(false);
  const activeShow = showOnScreen(podcast.library, podcast.screen);
  const continuePick = pickContinueListening(podcast.library);
  const continueEpisode = continuePick ? findEpisode(podcast.library, continuePick.episodeId) : null;
  const continueProgress = continuePick
    ? podcast.library.progressByEpisode[continuePick.episodeId]
    : null;
  const playing = podcast.player.episodeId
    ? findEpisode(podcast.library, podcast.player.episodeId)
    : null;

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="dark" />
        {!podcast.ready ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : podcast.screen.name === 'player' ? (
          <PlayerScreen
            showTitle={playing?.show.title ?? ''}
            episodeTitle={playing?.episode.title ?? '這一集'}
            message={podcast.player.message}
            positionMillis={podcast.player.positionMillis}
            durationMillis={podcast.player.durationMillis}
            downloading={podcast.player.status === 'downloading'}
            playing={podcast.player.status === 'playing'}
            onDevice={storedEpisodeIsOnDevice(
              playing ? podcast.library.filesByEpisode[playing.episode.id] : null,
              playing?.episode.expectedBytes ?? null,
            )}
            canRemove={
              podcast.player.status === 'error' ||
              Boolean(playing && podcast.library.filesByEpisode[playing.episode.id])
            }
            onBack={() =>
              podcast.setScreen(
                podcast.player.showId
                  ? { name: 'show', showId: podcast.player.showId }
                  : { name: 'home' },
              )
            }
            onToggle={() => void podcast.togglePlayback()}
            onSeekBy={(delta) => void podcast.seekBy(delta)}
            onSeekToRatio={(ratio) => void podcast.seekToRatio(ratio)}
            onRemoveDownload={() => {
              const episodeId = podcast.player.episodeId;
              const showId = podcast.player.showId;
              if (!episodeId || !showId) return;
              void podcast.removeDownload(episodeId).then(() => podcast.playEpisode(showId, episodeId));
            }}
            onSendToWatch={() => void podcast.sendToWatch()}
            watchSending={podcast.watchSending}
          />
        ) : (
          <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <View style={styles.flex}>
              {podcast.screen.name === 'home' ? (
                <HomeScreen
                  continueListening={
                    continueEpisode &&
                    continueProgress &&
                    continueEpisode.episode.id !== podcast.player.episodeId
                      ? {
                          showTitle: continueEpisode.show.title,
                          episodeTitle: continueEpisode.episode.title,
                          positionLabel: formatPlaybackTime(continueProgress.positionMillis),
                          onDevice: storedEpisodeIsOnDevice(
                            podcast.library.filesByEpisode[continueEpisode.episode.id],
                            continueEpisode.episode.expectedBytes,
                          ),
                          onPress: () =>
                            void podcast.playEpisode(continueEpisode.show.id, continueEpisode.episode.id),
                        }
                      : null
                  }
                  shows={podcast.library.shows.map((show) => ({
                    id: show.id,
                    title: show.title,
                    author: show.author,
                  }))}
                  onOpenShow={(showId) => podcast.setScreen({ name: 'show', showId })}
                  onAdd={() => {
                    podcast.clearAddError();
                    podcast.setScreen({ name: 'add' });
                  }}
                />
              ) : null}

              {podcast.screen.name === 'add' ? (
                <AddShowScreen
                  results={podcast.results}
                  searchBusy={podcast.searchBusy}
                  addBusy={podcast.addBusy}
                  error={podcast.addError}
                  onBack={() => podcast.setScreen({ name: 'home' })}
                  onSearch={(term) => void podcast.search(term)}
                  onAddFeed={(url) => void podcast.addFeed(url)}
                  onPick={(hit) => void podcast.addFeed(hit.feedUrl)}
                />
              ) : null}

              {podcast.screen.name === 'show' && activeShow ? (
                <ShowScreen
                  title={activeShow.title}
                  author={activeShow.author}
                  refreshing={podcast.refreshingId === activeShow.id}
                  refreshError={podcast.refreshError}
                  episodeOrder={activeShow.episodeOrder}
                  showHeard={showHeardEpisodes}
                  autoDownloadCount={activeShow.autoDownloadCount}
                  autoDownloading={Boolean(podcast.downloadingShows[activeShow.id])}
                  autoDownloadLabel={
                    Object.entries(podcast.downloadProgressById)
                      .map(([episodeId, progress]) => {
                        if (!activeShow.episodes.some((episode) => episode.id === episodeId)) return null;
                        return formatDownloadProgressText(progress);
                      })
                      .find((label) => label != null) ?? null
                  }
                  queueNote={podcast.queueNote}
                  episodes={sortedEpisodes(activeShow.episodes, activeShow.episodeOrder).map((episode) => ({
                    episode,
                    progress: podcast.library.progressByEpisode[episode.id] ?? null,
                    onDevice: storedEpisodeIsOnDevice(
                      podcast.library.filesByEpisode[episode.id],
                      episode.expectedBytes,
                    ),
                    downloadLabel: podcast.downloadProgressById[episode.id]
                      ? formatDownloadProgressText(podcast.downloadProgressById[episode.id]!)
                      : null,
                  }))}
                  onBack={() => podcast.setScreen({ name: 'home' })}
                  onRefresh={() => void podcast.refreshShow(activeShow.id)}
                  onPlay={(episodeId) => void podcast.playEpisode(activeShow.id, episodeId)}
                  onEpisodeOrder={(order) => podcast.setEpisodeOrder(activeShow.id, order)}
                  onShowHeard={setShowHeardEpisodes}
                  onAutoDownloadCount={(count) => podcast.setAutoDownloadCount(activeShow.id, count)}
                  onMarkHeard={(episodeId) => void podcast.markHeard(episodeId)}
                  onMarkUnheard={(episodeId) => podcast.markUnheard(episodeId)}
                  onDelete={() => void podcast.deleteShow(activeShow.id)}
                />
              ) : null}
            </View>
            {playing ? (
              <MiniPlayer
                title={playing.episode.title}
                subtitle={podcast.player.status === 'playing' ? '播放中' : podcast.player.message || playing.show.title}
                onPress={() => podcast.setScreen({ name: 'player' })}
              />
            ) : null}
          </SafeAreaView>
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
