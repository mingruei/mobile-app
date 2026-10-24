import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Alarm } from '../types/alarm';
import { RING_HINT, alarmTitle, formatTime } from '../utils/alarmLogic';
import { colors } from '../theme';

type Props = {
  alarm: Alarm;
  onDismiss: () => void;
};

export function RingingScreen({ alarm, onDismiss }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="關掉鬧鐘"
      onPress={onDismiss}
      style={styles.fill}
    >
      <View style={styles.content} pointerEvents="none">
        <Text style={styles.hint} maxFontSizeMultiplier={1.1}>
          {RING_HINT}
        </Text>
        <Text style={styles.time} maxFontSizeMultiplier={1.05}>
          {formatTime(alarm.hour, alarm.minute)}
        </Text>
        <Text style={styles.name} maxFontSizeMultiplier={1.1}>
          {alarmTitle(alarm)}
        </Text>
        <View style={styles.pill}>
          <Text style={styles.pillText} maxFontSizeMultiplier={1.1}>
            點一下就關
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.amber,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 18,
  },
  hint: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
    lineHeight: 38,
  },
  time: {
    fontSize: 84,
    fontWeight: '800',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  name: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.ink,
  },
  pill: {
    marginTop: 12,
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 16,
  },
  pillText: {
    color: colors.amber,
    fontSize: 28,
    fontWeight: '800',
  },
});
