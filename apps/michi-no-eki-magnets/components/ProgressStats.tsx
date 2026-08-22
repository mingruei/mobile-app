import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/theme';
import { useStations } from '../hooks/useStationData';
import { useStationProgress } from '../hooks/useStationProgress';
import { useI18n } from '../i18n';
import { computeProgressStats } from '../utils/progressStats';

export function ProgressStats() {
  const { t } = useI18n();
  const stations = useStations();
  const { progressMap } = useStationProgress();
  const stats = computeProgressStats(stations, progressMap);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerSpacer} />
        <Text style={styles.headerCell}>{t('stats.visited')}</Text>
        <Text style={styles.headerCell}>{t('stats.magnet')}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>{t('stats.rowTotal')}</Text>
        <Text style={styles.cell}>{stats.total.visited}</Text>
        <Text style={styles.cell}>{stats.total.magnet}</Text>
      </View>
      <Text style={styles.totalHint}>
        {t('stats.totalCount', { count: stats.total.total })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
  },
  headerSpacer: {
    flex: 1.1,
  },
  headerCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  rowLabel: {
    flex: 1.1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.original,
  },
  cell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  totalHint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
  },
});
