import { Alert, FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { Episode, EpisodeOrder, EpisodeProgress } from '../types/podcast';
import { MAX_AUTO_DOWNLOAD_COUNT } from '../utils/autoDownload';
import { formatPlaybackTime } from '../utils/media';
import { BigButton } from './BigButton';
import { colors, fonts } from '../theme';

export type EpisodeRow = {
  episode: Episode;
  progress: EpisodeProgress | null;
  onDevice: boolean;
  downloadLabel: string | null;
};

type Props = {
  title: string;
  author: string;
  episodes: EpisodeRow[];
  episodeOrder: EpisodeOrder;
  showHeard: boolean;
  autoDownloadCount: number;
  autoDownloading: boolean;
  autoDownloadLabel: string | null;
  queueNote: string | null;
  refreshing: boolean;
  refreshError: string | null;
  onBack: () => void;
  onRefresh: () => void;
  onPlay: (episodeId: string) => void;
  onEpisodeOrder: (order: EpisodeOrder) => void;
  onShowHeard: (show: boolean) => void;
  onAutoDownloadCount: (count: number) => void;
  onMarkHeard: (episodeId: string) => void;
  onMarkUnheard: (episodeId: string) => void;
  onDelete: () => void;
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('zh-Hant', { year: 'numeric', month: 'short', day: 'numeric' });
}

function statusLine(row: EpisodeRow): string {
  if (row.downloadLabel) return row.downloadLabel;
  const heard =
    row.progress && !row.progress.completed && row.progress.positionMillis >= 5000
      ? `聽到 ${formatPlaybackTime(row.progress.positionMillis)}`
      : '';
  const place = row.onDevice ? '在手機裡' : '還沒下載';
  if (row.progress?.completed) return '已聽過';
  return [heard, place].filter(Boolean).join(' · ');
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, selected ? styles.choiceOn : styles.choiceOff]}
    >
      <Text style={[styles.choiceLabel, selected ? styles.choiceLabelOn : styles.choiceLabelOff]} maxFontSizeMultiplier={1.2}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ShowScreen({
  title,
  author,
  episodes,
  episodeOrder,
  showHeard,
  autoDownloadCount,
  autoDownloading,
  autoDownloadLabel,
  queueNote,
  refreshing,
  refreshError,
  onBack,
  onRefresh,
  onPlay,
  onEpisodeOrder,
  onShowHeard,
  onAutoDownloadCount,
  onMarkHeard,
  onMarkUnheard,
  onDelete,
}: Props) {
  const visible = showHeard ? episodes : episodes.filter((row) => row.progress?.completed !== true);
  return (
    <FlatList
      data={visible}
      keyExtractor={(row) => row.episode.id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={onBack}>
            <Text style={styles.back} maxFontSizeMultiplier={1.2}>
              返回
            </Text>
          </Pressable>
          <Text style={styles.title} maxFontSizeMultiplier={1.2}>
            {title}
          </Text>
          {author ? (
            <Text style={styles.author} maxFontSizeMultiplier={1.2}>
              {author}
            </Text>
          ) : null}
          <View style={styles.orderRow}>
            <Choice label="從新到舊" selected={episodeOrder === 'newest'} onPress={() => onEpisodeOrder('newest')} />
            <Choice label="從舊到新" selected={episodeOrder === 'oldest'} onPress={() => onEpisodeOrder('oldest')} />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel} maxFontSizeMultiplier={1.2}>
              顯示已聽過
            </Text>
            <Switch
              accessibilityLabel="顯示已聽過"
              value={showHeard}
              onValueChange={onShowHeard}
              trackColor={{ false: colors.line, true: colors.accent }}
              ios_backgroundColor={colors.line}
            />
          </View>
          <View style={styles.stepper}>
            <Text style={styles.stepperLabel} maxFontSizeMultiplier={1.2}>
              {autoDownloadCount === 0 ? '不自動下載' : `自動下載未聽過的 ${autoDownloadCount} 集`}
            </Text>
            <View style={styles.stepperRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="少下載一集"
                onPress={() => onAutoDownloadCount(autoDownloadCount - 1)}
                disabled={autoDownloadCount <= 0}
                style={[styles.step, autoDownloadCount <= 0 ? styles.stepDisabled : null]}
              >
                <Text style={styles.stepLabel} maxFontSizeMultiplier={1.1}>
                  －
                </Text>
              </Pressable>
              <Text style={styles.stepValue} maxFontSizeMultiplier={1.1}>
                {autoDownloadCount}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="多下載一集"
                onPress={() => onAutoDownloadCount(autoDownloadCount + 1)}
                disabled={autoDownloadCount >= MAX_AUTO_DOWNLOAD_COUNT}
                style={[styles.step, autoDownloadCount >= MAX_AUTO_DOWNLOAD_COUNT ? styles.stepDisabled : null]}
              >
                <Text style={styles.stepLabel} maxFontSizeMultiplier={1.1}>
                  ＋
                </Text>
              </Pressable>
            </View>
            <Text style={styles.hint} maxFontSizeMultiplier={1.2}>
              聽過就刪掉音檔，再下載下一集未聽過的。
            </Text>
            {autoDownloading ? (
              <Text style={styles.hint} maxFontSizeMultiplier={1.2}>
                {autoDownloadLabel ?? '正在下載未聽過的單集'}
              </Text>
            ) : null}
          </View>
          <BigButton
            label={refreshing ? '更新中' : '更新節目'}
            onPress={onRefresh}
            disabled={refreshing}
            color={colors.ink}
          />
          {refreshError ? (
            <Text style={styles.error} maxFontSizeMultiplier={1.3}>
              {refreshError}
            </Text>
          ) : null}
          {queueNote ? (
            <Text style={styles.error} maxFontSizeMultiplier={1.3}>
              {queueNote}
            </Text>
          ) : null}
        </View>
      }
      renderItem={({ item }) => {
        const heard = item.progress?.completed === true;
        return (
          <View style={styles.row}>
            <Pressable accessibilityRole="button" onPress={() => onPlay(item.episode.id)}>
              <Text style={styles.episode} maxFontSizeMultiplier={1.2}>
                {item.episode.title}
              </Text>
              <Text style={styles.meta} maxFontSizeMultiplier={1.2}>
                {[formatDate(item.episode.publishedAt), item.episode.durationMillis ? formatPlaybackTime(item.episode.durationMillis) : '']
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <Text style={[styles.place, item.onDevice ? styles.onDevice : styles.waiting]} maxFontSizeMultiplier={1.2}>
                {statusLine(item)}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => (heard ? onMarkUnheard(item.episode.id) : onMarkHeard(item.episode.id))}
              style={styles.heard}
            >
              <Text style={styles.heardLabel} maxFontSizeMultiplier={1.2}>
                {heard ? '標成未聽' : '標成已聽過'}
              </Text>
            </Pressable>
          </View>
        );
      }}
      ListEmptyComponent={
        episodes.length > 0 ? (
          <Text style={styles.hint} maxFontSizeMultiplier={1.2}>
            已聽過的先藏起來。打開上面的開關就能看到。
          </Text>
        ) : (
          <Text style={styles.hint} maxFontSizeMultiplier={1.2}>
            這個節目還沒有單集。
          </Text>
        )
      }
      ListFooterComponent={
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            Alert.alert('移除這個節目？', '手機裡這個節目的音檔會一併刪掉。', [
              { text: '取消', style: 'cancel' },
              { text: '移除', style: 'destructive', onPress: onDelete },
            ]);
          }}
          style={styles.remove}
        >
          <Text style={styles.removeLabel} maxFontSizeMultiplier={1.2}>
            移除節目
          </Text>
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 12,
    paddingBottom: 40,
  },
  header: {
    gap: 12,
    marginBottom: 8,
  },
  back: {
    color: colors.accent,
    fontSize: 20,
    fontWeight: '800',
  },
  title: {
    fontSize: fonts.title,
    fontWeight: '800',
    color: colors.ink,
  },
  author: {
    fontSize: fonts.body,
    color: colors.muted,
  },
  error: {
    color: colors.red,
    fontSize: fonts.body,
    lineHeight: 28,
  },
  orderRow: {
    flexDirection: 'row',
    gap: 10,
  },
  switchRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
  },
  switchLabel: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
  },
  choice: {
    flex: 1,
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  choiceOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  choiceOff: {
    backgroundColor: colors.card,
    borderColor: colors.line,
  },
  choiceLabel: {
    fontSize: 20,
    fontWeight: '800',
  },
  choiceLabelOn: {
    color: '#fff',
  },
  choiceLabelOff: {
    color: colors.ink,
  },
  stepper: {
    gap: 8,
  },
  stepperLabel: {
    fontSize: fonts.body,
    fontWeight: '800',
    color: colors.ink,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  step: {
    width: 64,
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDisabled: {
    opacity: 0.35,
  },
  stepLabel: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  stepValue: {
    minWidth: 40,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '800',
    color: colors.ink,
  },
  hint: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.muted,
  },
  row: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 10,
  },
  episode: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
  },
  meta: {
    fontSize: 16,
    color: colors.muted,
  },
  place: {
    fontSize: 18,
    fontWeight: '700',
  },
  onDevice: {
    color: colors.green,
  },
  waiting: {
    color: colors.muted,
  },
  heard: {
    marginTop: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  heardLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  remove: {
    marginTop: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeLabel: {
    color: colors.red,
    fontSize: 20,
    fontWeight: '800',
  },
});
