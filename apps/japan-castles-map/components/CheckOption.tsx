import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/theme';

type CheckOptionProps = {
  label: string;
  checked: boolean;
  onToggle: () => void;
};

export function CheckOption({ label, checked, onToggle }: CheckOptionProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={styles.row}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Text style={styles.checkmark}>✓</Text> : null}
      </View>
      <Text style={styles.label}>{label}</Text>
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
});
