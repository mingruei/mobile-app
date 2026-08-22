import { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../constants/theme';
import { useDynamicTypeLayout } from '../hooks/useDynamicTypeLayout';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useI18n } from '../i18n';
import type { ProgressFilter } from '../types/station';

type Option = {
  value: string | null;
  label: string;
};

type LocationFiltersProps = {
  prefecture: string | null;
  progressFilter: ProgressFilter;
  prefectureOptions: readonly Option[];
  groupOptions?: readonly Option[];
  groupId?: string | null;
  onGroupChange?: (groupId: string | null) => void;
  onPrefectureChange: (prefecture: string | null) => void;
  onProgressFilterChange: (progressFilter: ProgressFilter) => void;
  nameQuery?: string;
  onNameQueryChange?: (nameQuery: string) => void;
};

type ActivePicker = 'prefecture' | 'progress' | 'group' | null;

function FilterField({
  label,
  value,
  onPress,
  disabled = false,
}: {
  label: string;
  value: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { minTouchTarget, isLargeContentSize } = useDynamicTypeLayout();

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}，${value}`}
        disabled={disabled}
        onPress={onPress}
        style={[
          styles.fieldButton,
          { minHeight: minTouchTarget },
          isLargeContentSize && styles.fieldButtonLarge,
          disabled && styles.fieldButtonDisabled,
        ]}
      >
        <Text
          style={[styles.fieldValue, disabled && styles.fieldValueDisabled]}
          numberOfLines={isLargeContentSize ? 3 : 2}
        >
          {value}
        </Text>
        <Text style={styles.fieldChevron}>▼</Text>
      </Pressable>
    </View>
  );
}

function SearchField({
  label,
  value,
  placeholder,
  onChangeText,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.searchInput}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
    </View>
  );
}

function PickerModal({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: readonly Option[];
  selectedValue: string | null;
  onSelect: (value: string | null) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const reduceMotionEnabled = useReduceMotion();
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'android' ? Math.max(insets.bottom, 16) : insets.bottom;

  return (
    <Modal
      animationType={reduceMotionEnabled ? 'none' : 'slide'}
      transparent
      visible={visible}
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.dismiss')}
        style={styles.modalBackdrop}
        onPress={onClose}
      >
        <Pressable
          style={[styles.modalSheet, { paddingBottom: bottomInset }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose}>
              <Text style={styles.modalClose}>{t('common.close')}</Text>
            </Pressable>
          </View>
          <ScrollView
            style={styles.modalList}
            contentContainerStyle={{ paddingBottom: bottomInset > 0 ? 8 : 16 }}
          >
            {options.map((option) => {
              const isSelected = option.value === selectedValue;
              return (
                <Pressable
                  key={option.value ?? option.label}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isSelected ? `${t('common.selected')}，${option.label}` : option.label
                  }
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    onSelect(option.value);
                    onClose();
                  }}
                  style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                >
                  <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
                    {isSelected ? `✓ ${option.label}` : option.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function LocationFilters({
  prefecture,
  progressFilter,
  prefectureOptions,
  groupOptions,
  groupId = null,
  onGroupChange,
  onPrefectureChange,
  onProgressFilterChange,
  nameQuery = '',
  onNameQueryChange,
}: LocationFiltersProps) {
  const { t } = useI18n();
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);

  const progressOptions = useMemo<readonly Option[]>(
    () => [
      { value: 'all', label: t('common.all') },
      { value: 'not-visited', label: t('filter.progressNotVisited') },
      { value: 'no-magnet', label: t('filter.progressNoMagnet') },
      { value: 'visited', label: t('filter.progressVisited') },
      { value: 'has-magnet', label: t('filter.progressHasMagnet') },
    ],
    [t],
  );

  const prefectureLabel =
    prefectureOptions.find((option) => option.value === prefecture)?.label ?? t('common.all');
  const progressLabel =
    progressOptions.find((option) => option.value === progressFilter)?.label ?? t('common.all');
  const groupLabel =
    groupOptions?.find((option) => option.value === groupId)?.label ?? t('common.all');
  const showGroupFilter = groupOptions != null && groupOptions.length > 1;

  return (
    <View style={styles.container}>
      {onNameQueryChange ? (
        <SearchField
          label={t('filter.name')}
          value={nameQuery}
          placeholder={t('filter.namePlaceholder')}
          onChangeText={onNameQueryChange}
        />
      ) : null}

      <FilterField
        label={t('filter.prefecture')}
        value={prefectureLabel}
        onPress={() => setActivePicker('prefecture')}
      />

      <FilterField
        label={t('filter.progress')}
        value={progressLabel}
        onPress={() => setActivePicker('progress')}
      />

      {showGroupFilter ? (
        <FilterField
          label={t('filter.group')}
          value={groupLabel}
          onPress={() => setActivePicker('group')}
        />
      ) : null}

      <PickerModal
        visible={activePicker === 'group'}
        title={t('filter.selectGroup')}
        options={groupOptions ?? []}
        selectedValue={groupId}
        onSelect={(value) => onGroupChange?.(value)}
        onClose={() => setActivePicker(null)}
      />

      <PickerModal
        visible={activePicker === 'progress'}
        title={t('filter.selectProgress')}
        options={progressOptions}
        selectedValue={progressFilter}
        onSelect={(value) => onProgressFilterChange((value ?? 'all') as ProgressFilter)}
        onClose={() => setActivePicker(null)}
      />

      <PickerModal
        visible={activePicker === 'prefecture'}
        title={t('filter.selectPrefecture')}
        options={prefectureOptions}
        selectedValue={prefecture}
        onSelect={onPrefectureChange}
        onClose={() => setActivePicker(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  fieldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  fieldButtonLarge: {
    alignItems: 'flex-start',
  },
  fieldButtonDisabled: {
    opacity: 0.55,
  },
  fieldValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  fieldValueDisabled: {
    color: colors.textMuted,
  },
  fieldChevron: {
    marginLeft: 8,
    fontSize: 12,
    color: colors.textMuted,
  },
  searchInput: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  modalSheet: {
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.surface,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalClose: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.original,
  },
  modalList: {
  },
  modalOption: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalOptionSelected: {
    backgroundColor: colors.originalLight,
  },
  modalOptionText: {
    fontSize: 16,
    color: colors.text,
  },
  modalOptionTextSelected: {
    fontWeight: '700',
    color: colors.originalSelectedText,
  },
});
