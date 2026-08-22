import type { ReactElement } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/theme';
import { useStationProgress } from '../hooks/useStationProgress';
import { useI18n } from '../i18n';
import type { Station } from '../types/station';
import type { StationProgressField } from '../types/stationProgress';

type StationListProps = {
  stations: readonly Station[];
  onSelectStation: (station: Station) => void;
  ListHeaderComponent?: ReactElement | null;
};

const PROGRESS_FIELDS: StationProgressField[] = ['visited', 'magnet', 'magnetNotSold'];

function ProgressTags({ stationId }: { stationId: number }) {
  const { t } = useI18n();
  const { getProgress } = useStationProgress();
  const progress = getProgress(stationId);

  const labels: Record<StationProgressField, string> = {
    visited: t('station.visited'),
    magnet: t('station.magnet'),
    magnetNotSold: t('station.magnetNotSold'),
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

function StationListItem({
  station,
  onPress,
}: {
  station: Station;
  onPress: () => void;
}) {
  const { getProgress } = useStationProgress();
  const progress = getProgress(station.id);
  const hasProgress = PROGRESS_FIELDS.some((field) => progress[field]);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.item, hasProgress && styles.itemWithProgress]}
    >
      <Text style={styles.itemTitle}>{station.name}</Text>
      <Text style={styles.itemLocation}>{station.location}</Text>
      <ProgressTags stationId={station.id} />
    </Pressable>
  );
}

export function StationList({ stations, onSelectStation, ListHeaderComponent }: StationListProps) {
  const { t } = useI18n();
  const { progressMap } = useStationProgress();

  return (
    <FlatList
      style={styles.list}
      data={stations}
      extraData={progressMap}
      keyExtractor={(station) => String(station.id)}
      ListHeaderComponent={ListHeaderComponent ?? undefined}
      contentContainerStyle={[
        styles.listContent,
        stations.length === 0 && styles.listContentEmpty,
      ]}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{t('station.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('station.emptyBody')}</Text>
        </View>
      }
      renderItem={({ item }) => (
        <StationListItem station={item} onPress={() => onSelectStation(item)} />
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
  itemTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
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
