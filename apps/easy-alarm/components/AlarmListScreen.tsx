import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { Alarm, Settings } from '../types/alarm';
import { formatClock, formatRepeat, formatTime, volumeLevel } from '../utils/alarmLogic';
import { colors, fonts } from '../theme';
import { BigButton } from './BigButton';

type Props = {
  now: Date;
  alarms: Alarm[];
  settings: Settings;
  permissionGranted: boolean;
  onAdd: () => void;
  onOpen: (alarm: Alarm) => void;
  onToggle: (id: string) => void;
  onToggleKeepScreenOn: () => void;
};

export function AlarmListScreen({
  now,
  alarms,
  settings,
  permissionGranted,
  onAdd,
  onOpen,
  onToggle,
  onToggleKeepScreenOn,
}: Props) {
  return (
    <View style={styles.screen}>
      <View style={styles.clockCard}>
        <Text style={styles.nowLabel} maxFontSizeMultiplier={1.1}>
          現在時間
        </Text>
        <Text style={styles.clock} maxFontSizeMultiplier={1.05}>
          {formatClock(now)}
        </Text>
      </View>

      {!permissionGranted ? (
        <Text style={styles.warn} maxFontSizeMultiplier={1.1}>
          請到設定打開通知，鎖定螢幕時鬧鐘才能響。
        </Text>
      ) : null}

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {alarms.length === 0 ? (
          <Text style={styles.empty} maxFontSizeMultiplier={1.1}>
            還沒有鬧鐘。按下面的按鈕新增。
          </Text>
        ) : (
          alarms.map((alarm) => (
            <Pressable
              key={alarm.id}
              accessibilityRole="button"
              onPress={() => onOpen(alarm)}
              style={[styles.row, !alarm.enabled && styles.rowOff]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTime} maxFontSizeMultiplier={1.05}>
                  {formatTime(alarm.hour, alarm.minute)}
                </Text>
                <Text style={styles.rowMeta} maxFontSizeMultiplier={1.1}>
                  {formatRepeat(alarm.repeat)} · 音量 {volumeLevel(alarm.volume)}
                </Text>
              </View>
              <Switch
                value={alarm.enabled}
                onValueChange={() => onToggle(alarm.id)}
                trackColor={{ false: colors.off, true: colors.green }}
                ios_backgroundColor={colors.off}
                style={styles.switch}
              />
            </Pressable>
          ))
        )}
      </ScrollView>

      <View style={styles.keepRow}>
        <View style={styles.keepText}>
          <Text style={styles.keepTitle} maxFontSizeMultiplier={1.1}>
            螢幕不要關
          </Text>
          <Text style={styles.keepHint} maxFontSizeMultiplier={1.1}>
            可鎖螢幕或按 Home。不要上滑關掉 App
          </Text>
        </View>
        <Switch
          value={settings.keepScreenOn}
          onValueChange={onToggleKeepScreenOn}
          trackColor={{ false: colors.off, true: colors.green }}
          ios_backgroundColor={colors.off}
          style={styles.switch}
        />
      </View>

      <BigButton label="新增鬧鐘" onPress={onAdd} color={colors.green} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  clockCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.line,
    alignItems: 'center',
    paddingVertical: 10,
  },
  nowLabel: {
    fontSize: 18,
    color: colors.muted,
    fontWeight: '700',
  },
  clock: {
    fontSize: fonts.clock,
    fontWeight: '800',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  warn: {
    fontSize: 18,
    lineHeight: 24,
    color: colors.red,
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 10,
    paddingBottom: 8,
  },
  empty: {
    fontSize: fonts.body,
    lineHeight: 28,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 24,
  },
  row: {
    minHeight: 84,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.line,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowOff: {
    opacity: 0.55,
  },
  rowText: {
    flex: 1,
  },
  rowTime: {
    fontSize: fonts.alarmTime,
    fontWeight: '800',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  rowMeta: {
    fontSize: 18,
    color: colors.muted,
    fontWeight: '700',
  },
  switch: {
    transform: [{ scaleX: 1.25 }, { scaleY: 1.25 }],
  },
  keepRow: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  keepText: {
    flex: 1,
  },
  keepTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
  },
  keepHint: {
    fontSize: 16,
    color: colors.muted,
    fontWeight: '600',
  },
});
