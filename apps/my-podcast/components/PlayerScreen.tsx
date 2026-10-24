import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatPlaybackTime } from '../utils/media';
import { BigButton } from './BigButton';
import { colors, fonts } from '../theme';

type Props = {
  showTitle: string;
  episodeTitle: string;
  message: string;
  positionMillis: number;
  durationMillis: number;
  downloading: boolean;
  playing: boolean;
  onDevice: boolean;
  canRemove: boolean;
  onBack: () => void;
  onToggle: () => void;
  onSeekBy: (deltaMillis: number) => void;
  onSeekToRatio: (ratio: number) => void;
  onRemoveDownload: () => void;
  onSendToWatch: () => void;
  watchSending: boolean;
};

export function PlayerScreen({
  showTitle,
  episodeTitle,
  message,
  positionMillis,
  durationMillis,
  downloading,
  playing,
  onDevice,
  canRemove,
  onBack,
  onToggle,
  onSeekBy,
  onSeekToRatio,
  onRemoveDownload,
  onSendToWatch,
  watchSending,
}: Props) {
  const ratio = durationMillis > 0 ? Math.min(1, positionMillis / durationMillis) : 0;
  const playLabel = downloading ? '下載中' : playing ? '暫停' : '播放';
  const barWidth = useRef(0);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" onPress={onBack}>
          <Text style={styles.back} maxFontSizeMultiplier={1.2}>
            返回
          </Text>
        </Pressable>
        <Text style={styles.show} maxFontSizeMultiplier={1.2}>
          {showTitle}
        </Text>
        <Text style={styles.episode} maxFontSizeMultiplier={1.2}>
          {episodeTitle}
        </Text>
        <Text style={styles.message} maxFontSizeMultiplier={1.3}>
          {message}
        </Text>
        {onDevice ? (
          <Text style={styles.local} maxFontSizeMultiplier={1.2}>
            音檔在這支手機裡。
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="adjustable"
          disabled={durationMillis <= 0 || downloading}
          onLayout={(event) => {
            barWidth.current = event.nativeEvent.layout.width;
          }}
          onPress={(event) => {
            if (barWidth.current <= 0) return;
            onSeekToRatio(event.nativeEvent.locationX / barWidth.current);
          }}
          style={styles.seekHit}
        >
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
          </View>
        </Pressable>
        <Text style={styles.time} maxFontSizeMultiplier={1.2}>
          {formatPlaybackTime(positionMillis)} / {formatPlaybackTime(durationMillis)}
        </Text>

        <View style={styles.transport}>
          <BigButton label="倒回 15 秒" onPress={() => onSeekBy(-15000)} color={colors.ink} disabled={downloading} />
          <BigButton label={playLabel} onPress={onToggle} disabled={downloading} />
          <BigButton label="前進 30 秒" onPress={() => onSeekBy(30000)} color={colors.ink} disabled={downloading} />
        </View>

        {onDevice ? (
          <BigButton
            label={watchSending ? '傳到手表中' : '傳到手表'}
            onPress={onSendToWatch}
            color={colors.ink}
            disabled={watchSending || downloading}
          />
        ) : null}

        {canRemove ? (
          <BigButton
            label="刪掉並重新下載"
            onPress={onRemoveDownload}
            color={colors.red}
            disabled={downloading}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    padding: 20,
    gap: 14,
  },
  back: {
    color: colors.accent,
    fontSize: 20,
    fontWeight: '800',
  },
  show: {
    color: colors.muted,
    fontSize: fonts.body,
  },
  episode: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: '800',
  },
  message: {
    color: colors.ink,
    fontSize: fonts.body,
    lineHeight: 30,
  },
  local: {
    color: colors.green,
    fontSize: fonts.body,
    fontWeight: '800',
  },
  seekHit: {
    paddingVertical: 12,
  },
  track: {
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  time: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
  },
  transport: {
    gap: 10,
  },
});
