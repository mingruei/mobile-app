import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/theme';
import { useDynamicTypeLayout } from '../hooks/useDynamicTypeLayout';

type CheckOptionProps = {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
};

export function CheckOption({ label, checked, disabled = false, onToggle }: CheckOptionProps) {
  const { isLargeContentSize } = useDynamicTypeLayout();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onToggle}
      style={[styles.row, isLargeContentSize && styles.rowLarge, disabled && styles.rowDisabled]}
    >
      <View style={[styles.box, checked && styles.boxChecked, disabled && styles.boxDisabled]}>
        {checked ? <Text style={styles.checkmark}>✓</Text> : null}
      </View>
      <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  rowLarge: {
    alignItems: 'flex-start',
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  boxChecked: {
    borderColor: colors.original,
    backgroundColor: colors.originalLight,
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.original,
    lineHeight: 16,
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  boxDisabled: {
    backgroundColor: colors.background,
  },
  labelDisabled: {
    color: colors.textMuted,
  },
});
