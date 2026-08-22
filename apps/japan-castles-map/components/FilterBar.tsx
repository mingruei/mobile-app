import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/theme';
import type { SeriesFilter } from '../types/castle';

type FilterOption = {
  id: SeriesFilter;
  label: string;
  color: string;
};

const OPTIONS: FilterOption[] = [
  { id: 'all', label: 'All 200', color: colors.text },
  { id: 'original', label: '100名城', color: colors.original },
  { id: 'continued', label: '続100名城', color: colors.continued },
];

type FilterBarProps = {
  activeFilter: SeriesFilter;
  counts: Record<SeriesFilter, number>;
  onChange: (filter: SeriesFilter) => void;
};

export function FilterBar({ activeFilter, counts, onChange }: FilterBarProps) {
  return (
    <View style={styles.container}>
      {OPTIONS.map((option) => {
        const isActive = activeFilter === option.id;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(option.id)}
            style={[
              styles.chip,
              isActive && { backgroundColor: option.color, borderColor: option.color },
            ]}
          >
            <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
              {option.label}
            </Text>
            <Text style={[styles.chipCount, isActive && styles.chipLabelActive]}>
              {counts[option.id]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  chipCount: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textMuted,
  },
  chipLabelActive: {
    color: colors.surface,
  },
});
