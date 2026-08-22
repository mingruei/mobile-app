import { StyleSheet, Text, View } from 'react-native';

import type { StationServiceId } from '../constants/stationServices';
import { colors } from '../constants/theme';
import { useI18n } from '../i18n';
import type { RegionId } from '../constants/regions';
import type { ProgressFilter } from '../types/station';
import { LocationFilters } from './LocationFilters';
import { ProgressStats } from './ProgressStats';

type Option = {
  value: string | null;
  label: string;
};

type BrowseListHeaderProps = {
  progressFilter: ProgressFilter;
  regionId: RegionId | null;
  prefecture: string | null;
  selectedServices: readonly StationServiceId[];
  nameQuery: string;
  prefectureOptions: readonly Option[];
  groupOptions?: readonly Option[];
  groupId?: string | null;
  resultCount: number;
  onProgressFilterChange: (progressFilter: ProgressFilter) => void;
  onGroupChange?: (groupId: string | null) => void;
  onRegionChange: (regionId: RegionId | null) => void;
  onPrefectureChange: (prefecture: string | null) => void;
  onNameQueryChange: (nameQuery: string) => void;
  onServicesChange: (services: StationServiceId[]) => void;
};

export function BrowseListHeader({
  progressFilter,
  regionId,
  prefecture,
  selectedServices,
  nameQuery,
  prefectureOptions,
  groupOptions,
  groupId,
  resultCount,
  onProgressFilterChange,
  onGroupChange,
  onRegionChange,
  onPrefectureChange,
  onNameQueryChange,
  onServicesChange,
}: BrowseListHeaderProps) {
  const { t, formatCount } = useI18n();

  return (
    <View style={styles.frame}>
      <ProgressStats />
      <View style={styles.divider} />
      <LocationFilters
        progressFilter={progressFilter}
        regionId={regionId}
        prefecture={prefecture}
        selectedServices={selectedServices}
        nameQuery={nameQuery}
        prefectureOptions={prefectureOptions}
        groupOptions={groupOptions}
        groupId={groupId}
        onProgressFilterChange={onProgressFilterChange}
        onGroupChange={onGroupChange}
        onRegionChange={onRegionChange}
        onPrefectureChange={onPrefectureChange}
        onNameQueryChange={onNameQueryChange}
        onServicesChange={onServicesChange}
      />
      <View style={styles.divider} />
      <View style={styles.resultBar}>
        <Text style={styles.resultCount}>{formatCount(resultCount)}</Text>
        <Text style={styles.resultHint}>{t('filter.resultHint')}</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  resultCount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  resultHint: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
