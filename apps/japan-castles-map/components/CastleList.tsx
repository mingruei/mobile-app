import type { ReactElement } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/theme';
import { useCastleContent } from '../hooks/useCastleContent';
import { useCastleProgress } from '../hooks/useCastleProgress';
import { useI18n } from '../i18n';
import type { Castle } from '../types/castle';
import type { CastleProgressField } from '../types/castleProgress';
import { formatChineseSubtitleLine } from '../utils/castleDisplayName';

type CastleListProps = {
  castles: readonly Castle[];
  onSelectCastle: (castle: Castle) => void;
  ListHeaderComponent?: ReactElement | null;
};

const PROGRESS_FIELDS: CastleProgressField[] = ['visited', 'meijoStamp', 'goshuin', 'castleCard'];

function ProgressTags({ castleId }: { castleId: number }) {
  const { t } = useI18n();
  const { getProgress } = useCastleProgress();
  const progress = getProgress(castleId);

  const labels: Record<CastleProgressField, string> = {
    visited: t('castle.visited'),
    meijoStamp: t('castle.meijoStamp'),
    goshuin: t('castle.goshuin'),
    castleCard: t('castle.castleCard'),
  };

  const checked = PROGRESS_FIELDS.filter((field) => progress[field]);

  if (checked.length === 0) {
    return null;
  }

  return (
    <View style={styles.progressRow}>
      {checked.map((field) => (
        <View key={field} style={styles.progressTag}>
          <Text style={styles.progressCheck}>✓</Text>
          <Text style={styles.progressTagText}>{labels[field]}</Text>
        </View>
      ))}
    </View>
  );
}

function CastleListItem({
  castle,
  onPress,
}: {
  castle: Castle;
  onPress: () => void;
}) {
  const { t, getSeriesLabel } = useI18n();
  const content = useCastleContent(castle);
  const { getProgress } = useCastleProgress();
  const progress = getProgress(castle.id);
  const hasProgress = PROGRESS_FIELDS.some((field) => progress[field]);
  const seriesColor = castle.series === 'original' ? colors.original : colors.continued;
  const chineseSubtitleLine = content.subtitle
    ? formatChineseSubtitleLine(content.subtitle, content.alias)
    : null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.item, hasProgress && styles.itemWithProgress]}
    >
      <View style={styles.itemHeader}>
        <Text style={styles.itemNumber}>
          {t('common.number')} {castle.number}
        </Text>
        <View style={[styles.seriesBadge, { backgroundColor: `${seriesColor}18` }]}>
          <Text style={[styles.seriesBadgeText, { color: seriesColor }]}>
            {getSeriesLabel(castle.series)}
          </Text>
        </View>
      </View>
      <Text style={styles.itemTitle}>{castle.name}</Text>
      {chineseSubtitleLine ? (
        <Text style={styles.itemSubtitle}>{chineseSubtitleLine}</Text>
      ) : null}
      <Text style={styles.itemLocation}>{content.locationLabel}</Text>
      <ProgressTags castleId={castle.id} />
    </Pressable>
  );
}

export function CastleList({ castles, onSelectCastle, ListHeaderComponent }: CastleListProps) {
  const { t } = useI18n();
  const { progressMap } = useCastleProgress();

  return (
    <FlatList
      style={styles.list}
      data={castles}
      extraData={progressMap}
      keyExtractor={(castle) => String(castle.id)}
      ListHeaderComponent={ListHeaderComponent ?? undefined}
      contentContainerStyle={[
        styles.listContent,
        castles.length === 0 && styles.listContentEmpty,
      ]}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{t('castle.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('castle.emptyBody')}</Text>
        </View>
      }
      renderItem={({ item }) => (
        <CastleListItem castle={item} onPress={() => onSelectCastle(item)} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  item: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  itemWithProgress: {
    borderColor: colors.original,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  seriesBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  seriesBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  itemSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textMuted,
  },
  itemLocation: {
    marginTop: 8,
    fontSize: 14,
    color: colors.text,
  },
  progressRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  progressTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.originalLight,
  },
  progressCheck: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.original,
  },
  progressTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.original,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  emptyBody: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
});
