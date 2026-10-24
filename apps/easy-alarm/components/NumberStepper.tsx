import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

type Props = {
  label: string;
  value: string;
  onIncrement: () => void;
  onDecrement: () => void;
};

function Step({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.step, { opacity: pressed ? 0.85 : 1 }]}
    >
      <Text style={styles.stepLabel} maxFontSizeMultiplier={1.1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function NumberStepper({ label, value, onIncrement, onDecrement }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.caption} maxFontSizeMultiplier={1.1}>
        {label}
      </Text>
      <Step label="＋" onPress={onIncrement} />
      <Text style={styles.value} maxFontSizeMultiplier={1.05}>
        {value}
      </Text>
      <Step label="－" onPress={onDecrement} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  caption: {
    fontSize: fonts.body,
    fontWeight: '700',
    color: colors.muted,
  },
  step: {
    width: '100%',
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
  },
  value: {
    fontSize: fonts.stepper,
    fontWeight: '800',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
});
