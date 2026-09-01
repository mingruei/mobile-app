import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ResizeMode, Video } from 'expo-av';
import {
  displayName,
  filesFolderLabel,
  formatClock,
  isCompactPhoneLayout,
  isLandscapeLayout,
  volumePercent,
} from './public/player-logic.mjs';
import { isTabletDevice } from './src/device';
import { useMusicPlayer } from './src/useMusicPlayer';

function BigButton({
  label,
  color,
  onPress,
  flex = 1,
}: {
  label: string;
  color: string;
  onPress: () => void;
  flex?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: color,
          flex: flex === 0 ? undefined : flex,
          alignSelf: flex === 0 ? 'stretch' : undefined,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <Text style={styles.btnLabel}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  const player = useMusicPlayer();
  const { width, height } = useWindowDimensions();
  const tablet = isTabletDevice();
  const landscape = tablet && isLandscapeLayout(width, height);
  const compact = isCompactPhoneLayout(width, height, tablet);
  const progress =
    player.duration > 0 ? Math.min(1, player.position / player.duration) : 0;
  const folder = filesFolderLabel(tablet);

  const lcd = (
    <View style={styles.lcd}>
      <Text style={styles.songTitle}>
        {player.current ? displayName(player.current.name) : '還沒有歌曲'}
      </Text>
      <Text style={styles.songMeta}>
        {player.current
          ? `第 ${player.index + 1} 首，共 ${player.tracks.length} 首`
          : '等候歌曲'}
      </Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.clock}>
        {formatClock(player.position)} / {formatClock(player.duration)}
      </Text>
    </View>
  );

  const buttons = (
    <>
      <Text style={styles.status}>{player.status}</Text>
      {compact ? null : landscape ? (
        <>
          <BigButton label="上一首" color="#0b5ea8" onPress={player.prev} flex={0} />
          <BigButton label="下一首" color="#0b5ea8" onPress={player.next} flex={0} />
        </>
      ) : (
        <View style={styles.row}>
          <BigButton label="上一首" color="#0b5ea8" onPress={player.prev} />
          <BigButton label="下一首" color="#0b5ea8" onPress={player.next} />
        </View>
      )}
      <View style={styles.row}>
        <BigButton label="小聲" color="#6b2d8b" onPress={() => void player.volumeDown()} />
        <View style={styles.volumeBox}>
          <Text style={styles.volumeLabel}>{volumePercent(player.volume)}</Text>
        </View>
        <BigButton label="大聲" color="#6b2d8b" onPress={() => void player.volumeUp()} />
      </View>
      <BigButton label="關閉" color="#b21818" onPress={() => void player.closePlayer()} flex={0} />
      {!player.tracks.length ? (
        <Text style={styles.help}>
          請把歌曲放到「檔案」App → 瀏覽 → {folder} → 大字播
        </Text>
      ) : null}
    </>
  );

  const video = player.showVideo && player.videoUri ? (
    <Video
      ref={player.videoRef}
      key={player.videoUri}
      source={{ uri: player.videoUri }}
      style={styles.video}
      resizeMode={ResizeMode.CONTAIN}
      shouldPlay={false}
      isLooping={false}
      useNativeControls={false}
      progressUpdateIntervalMillis={400}
      onPlaybackStatusUpdate={player.onVideoStatus}
    />
  ) : null;

  let body = (
    <>
      {compact ? null : lcd}
      {buttons}
    </>
  );

  if (tablet && landscape) {
    body = (
      <>
        <View style={styles.mediaPane}>{video ?? <View style={styles.mediaPlaceholder}>{lcd}</View>}</View>
        <View style={styles.controlsSide}>
          {video ? lcd : null}
          {buttons}
        </View>
      </>
    );
  } else if (tablet) {
    body = (
      <>
        <View style={styles.mediaPane}>{video ?? <View style={styles.mediaPlaceholder}>{lcd}</View>}</View>
        {video ? lcd : null}
        {buttons}
      </>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={[styles.player, landscape && styles.playerRow, compact && styles.playerCompact]}>{body}</View>
        {player.needsStart ? (
          <View style={styles.overlay}>
            <Pressable style={styles.overlayBtn} onPress={() => void player.play()}>
              <Text style={styles.overlayBtnLabel}>開始播放</Text>
            </Pressable>
            <Text style={styles.overlayText}>請按一次這個大按鈕</Text>
          </View>
        ) : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#2a1a10',
  },
  player: {
    flex: 1,
    margin: 12,
    padding: 16,
    backgroundColor: '#ead7a8',
    borderRadius: 28,
    borderWidth: 6,
    borderColor: '#3b2414',
    gap: 10,
  },
  playerCompact: {
    justifyContent: 'center',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  mediaPane: {
    flex: 1,
    minHeight: 220,
    backgroundColor: '#1a1408',
    borderRadius: 18,
    borderWidth: 4,
    borderColor: '#7a5724',
    overflow: 'hidden',
  },
  mediaPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  video: {
    flex: 1,
    backgroundColor: '#000',
  },
  controlsSide: {
    width: 288,
    maxWidth: '34%',
    gap: 10,
    justifyContent: 'center',
  },
  lcd: {
    backgroundColor: '#1a1408',
    borderRadius: 18,
    padding: 14,
    borderWidth: 4,
    borderColor: '#7a5724',
    gap: 8,
  },
  songTitle: {
    color: '#ffc14d',
    fontSize: 30,
    fontWeight: '800',
  },
  songMeta: {
    color: '#c48a2b',
    fontSize: 20,
  },
  progressTrack: {
    height: 18,
    backgroundColor: '#3a2a12',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ffc14d',
  },
  clock: {
    color: '#c48a2b',
    fontSize: 20,
    fontVariant: ['tabular-nums'],
  },
  status: {
    textAlign: 'center',
    fontSize: 22,
    color: '#22160d',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    minHeight: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  btnLabel: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  volumeBox: {
    minWidth: 84,
    borderRadius: 18,
    borderWidth: 4,
    borderColor: '#5a3a22',
    backgroundColor: '#f4e6c4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  volumeLabel: {
    fontSize: 26,
    fontWeight: '800',
    color: '#22160d',
  },
  help: {
    marginTop: 4,
    fontSize: 20,
    lineHeight: 28,
    color: '#22160d',
    backgroundColor: '#fff7e4',
    borderRadius: 18,
    padding: 12,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20, 10, 4, 0.78)',
    alignItems: 'center',
    paddingTop: '22%',
    paddingHorizontal: 24,
    gap: 16,
  },
  overlayBtn: {
    width: '100%',
    maxWidth: 420,
    minHeight: 92,
    borderRadius: 22,
    backgroundColor: '#157a32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayBtnLabel: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
  },
  overlayText: {
    color: '#fff',
    fontSize: 24,
    textAlign: 'center',
  },
});
