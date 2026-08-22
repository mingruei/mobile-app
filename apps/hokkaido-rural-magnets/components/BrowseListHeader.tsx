import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/theme';
import { useDynamicTypeLayout } from '../hooks/useDynamicTypeLayout';
import { useI18n } from '../i18n';
import type { ProgressFilter } from '../types/station';
import { LocationFilters } from './LocationFilters';
import { ProgressStats } from './ProgressStats';

type Option = {
  value: string | null;
  label: string;
};

type BrowseListHeaderProps = {
  progressFilter: ProgressFilter;
  prefecture: string | null;
  nameQuery: string;
  prefectureOptions: readonly Option[];
  groupOptions?: readonly Option[];
  groupId?: string | null;
  resultCount: number;
  onProgressFilterChange: (progressFilter: ProgressFilter) => void;
  onGroupChange?: (groupId: string | null) => void;
  onPrefectureChange: (prefecture: string | null) => void;
  onNameQueryChange: (nameQuery: string) => void;
};

export function BrowseListHeader({
  progressFilter,
  prefecture,
  nameQuery,
  prefectureOptions,
  groupOptions,
  groupId,
  resultCount,
  onProgressFilterChange,
  onGroupChange,
  onPrefectureChange,
  onNameQueryChange,
}: BrowseListHeaderProps) {
  const { t, formatCount } = useI18n();
  const { isLargeContentSize } = useDynamicTypeLayout();

  return (
    <View style={styles.frame}>
      <ProgressStats />
      <View style={styles.divider} />
      <LocationFilters
        progressFilter={progressFilter}
        prefecture={prefecture}
        nameQuery={nameQuery}
        prefectureOptions={prefectureOptions}
        groupOptions={groupOptions}
        groupId={groupId}
        onProgressFilterChange={onProgressFilterChange}
        onGroupChange={onGroupChange}
        onPrefectureChange={onPrefectureChange}
        onNameQueryChange={onNameQueryChange}
      />
      <View style={styles.divider} />
      <View style={[styles.resultBar, isLargeContentSize && styles.resultBarLarge]}>
        <Text style={styles.resultCount}>{formatCount(resultCount)}</Text>
        <Text style={[styles.resultHint, isLargeContentSize && styles.resultHintLarge]}>
          {t('filter.resultHint')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    marginHorizontal: -16,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  resultBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  resultBarLarge: {
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  resultCount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  resultHint: {
    flexShrink: 1,
    fontSize: 13,
    color: colors.textMuted,
  },
  resultHintLarge: {
    flexBasis: '100%',
  },
});
