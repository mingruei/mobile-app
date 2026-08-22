import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/theme';
import { useCastles } from '../hooks/useCastleData';
import { useCastleProgress } from '../hooks/useCastleProgress';
import { useI18n } from '../i18n';
import type { Castle } from '../types/castle';
import { computeProgressStats } from '../utils/progressStats';

type StatsRowProps = {
  label: string;
  visited: number;
  meijoStamp: number;
  goshuin: number;
  castleCard: number;
  highlight?: boolean;
};

function StatsRow({ label, visited, meijoStamp, goshuin, castleCard, highlight = false }: StatsRowProps) {
  return (
    <View style={[styles.row, highlight && styles.rowHighlight]}>
      <Text style={[styles.rowLabel, highlight && styles.rowLabelHighlight]}>{label}</Text>
      <Text style={styles.cell}>{visited}</Text>
      <Text style={styles.cell}>{meijoStamp}</Text>
      <Text style={styles.cell}>{goshuin}</Text>
      <Text style={styles.cell}>{castleCard}</Text>
    </View>
  );
}

export function ProgressStats() {
  const { t } = useI18n();
  const castles = useCastles();
  const { progressMap } = useCastleProgress();
  const stats = computeProgressStats(castles, progressMap);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerSpacer} />
        <Text style={styles.headerCell}>{t('stats.visited')}</Text>
        <Text style={styles.headerCell}>{t('stats.meijoStamp')}</Text>
        <Text style={styles.headerCell}>{t('stats.goshuin')}</Text>
        <Text style={styles.headerCell}>{t('stats.castleCard')}</Text>
      </View>

      <StatsRow
        label={t('stats.rowOriginal')}
        visited={stats.original.visited}
        meijoStamp={stats.original.meijoStamp}
        goshuin={stats.original.goshuin}
        castleCard={stats.original.castleCard}
      />
      <StatsRow
        label={t('stats.rowContinued')}
        visited={stats.continued.visited}
        meijoStamp={stats.continued.meijoStamp}
        goshuin={stats.continued.goshuin}
        castleCard={stats.continued.castleCard}
      />
      <StatsRow
        label={t('stats.rowTotal')}
        visited={stats.total.visited}
        meijoStamp={stats.total.meijoStamp}
        goshuin={stats.total.goshuin}
        castleCard={stats.total.castleCard}
        highlight
      />
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
  },
  rowHighlight: {
    backgroundColor: colors.background,
  },
  rowLabel: {
    flex: 1.1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  rowLabelHighlight: {
    color: colors.original,
  },
  cell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
});
