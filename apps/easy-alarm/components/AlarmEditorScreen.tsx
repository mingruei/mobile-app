import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Alarm, RepeatRule, Weekday } from '../types/alarm';
import {
  ALL_DAYS,
  WEEKDAY_LABELS,
  WEEKDAYS,
  createAlarm,
  pad2,
  stepHour,
  stepMinute,
  stepVolume,
  toggleCustomDay,
  volumeLevel,
} from '../utils/alarmLogic';
import { previewAlarmSound } from '../utils/alarmSound';
import { colors, fonts } from '../theme';
import { BigButton } from './BigButton';
import { NumberStepper } from './NumberStepper';

type Props = {
  alarm: Alarm;
  isNew: boolean;
  onCancel: () => void;
  onSave: (alarm: Alarm) => void;
  onDelete: (id: string) => void;
};

const REPEAT_OPTIONS: { label: string; repeat: RepeatRule }[] = [
  { label: '一次', repeat: { type: 'once' } },
  { label: '每天', repeat: { type: 'daily' } },
  { label: '平日', repeat: { type: 'weekdays' } },
  { label: '週末', repeat: { type: 'weekends' } },
  { label: '自訂', repeat: { type: 'custom', days: WEEKDAYS } },
];

function sameRepeat(a: RepeatRule, b: RepeatRule): boolean {
  return a.type === b.type;
}

export function AlarmEditorScreen({ alarm, isNew, onCancel, onSave, onDelete }: Props) {
  const [draft, setDraft] = useState(() => createAlarm(alarm));

  const setRepeat = (repeat: RepeatRule) => {
    if (repeat.type === 'custom' && draft.repeat.type === 'custom') {
      return;
    }
    setDraft((current) => ({
      ...current,
      repeat:
        repeat.type === 'custom' && current.repeat.type === 'custom'
          ? current.repeat
          : repeat,
    }));
  };

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.topBtn}>
          <Text style={styles.topBtnText} maxFontSizeMultiplier={1.1}>
            返回
          </Text>
        </Pressable>
        {!isNew ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => onDelete(draft.id)}
            style={styles.topBtn}
          >
            <Text style={[styles.topBtnText, { color: colors.red }]} maxFontSizeMultiplier={1.1}>
              刪除
            </Text>
          </Pressable>
        ) : (
          <View style={styles.topBtn} />
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.timeRow}>
          <NumberStepper
            label="時"
            value={pad2(draft.hour)}
            onIncrement={() => setDraft((current) => ({ ...current, hour: stepHour(current.hour, 1) }))}
            onDecrement={() =>
              setDraft((current) => ({ ...current, hour: stepHour(current.hour, -1) }))
            }
          />
          <Text style={styles.colon} maxFontSizeMultiplier={1.05}>
            :
          </Text>
          <NumberStepper
            label="分"
            value={pad2(draft.minute)}
            onIncrement={() =>
              setDraft((current) => ({ ...current, minute: stepMinute(current.minute, 1) }))
            }
            onDecrement={() =>
              setDraft((current) => ({ ...current, minute: stepMinute(current.minute, -1) }))
            }
          />
        </View>

        <Text style={styles.section} maxFontSizeMultiplier={1.1}>
          頻率
        </Text>
        <View style={styles.chips}>
          {REPEAT_OPTIONS.map((option) => {
            const selected = sameRepeat(draft.repeat, option.repeat);
            return (
              <Pressable
                key={option.label}
                accessibilityRole="button"
                onPress={() => setRepeat(option.repeat)}
                style={[styles.chip, selected && styles.chipOn]}
              >
                <Text
                  style={[styles.chipText, selected && styles.chipTextOn]}
                  maxFontSizeMultiplier={1.1}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {draft.repeat.type === 'custom' ? (
          <View style={styles.days}>
            {ALL_DAYS.map((day) => {
              const selected = draft.repeat.type === 'custom' && draft.repeat.days.includes(day);
              return (
                <Pressable
                  key={day}
                  accessibilityRole="button"
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      repeat: {
                        type: 'custom',
                        days: toggleCustomDay(
                          current.repeat.type === 'custom' ? current.repeat.days : WEEKDAYS,
                          day as Weekday,
                        ),
                      },
                    }))
                  }
                  style={[styles.day, selected && styles.dayOn]}
                >
                  <Text
                    style={[styles.dayText, selected && styles.dayTextOn]}
                    maxFontSizeMultiplier={1.1}
                  >
                    {WEEKDAY_LABELS[day]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Text style={styles.section} maxFontSizeMultiplier={1.1}>
          音量
        </Text>
        <View style={styles.volumeRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              setDraft((current) => ({ ...current, volume: stepVolume(current.volume, -0.1) }))
            }
            style={styles.volumeBtn}
          >
            <Text style={styles.volumeBtnText} maxFontSizeMultiplier={1.1}>
              －
            </Text>
          </Pressable>
          <Text style={styles.volumeValue} maxFontSizeMultiplier={1.1}>
            {volumeLevel(draft.volume)}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              setDraft((current) => ({ ...current, volume: stepVolume(current.volume, 0.1) }))
            }
            style={styles.volumeBtn}
          >
            <Text style={styles.volumeBtnText} maxFontSizeMultiplier={1.1}>
              ＋
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void previewAlarmSound(draft.volume)}
            style={styles.preview}
          >
            <Text style={styles.previewText} maxFontSizeMultiplier={1.1}>
              試聽
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <BigButton label="儲存" onPress={() => onSave(draft)} color={colors.green} />
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
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topBtn: {
    minHeight: 48,
    minWidth: 72,
    justifyContent: 'center',
  },
  topBtnText: {
    fontSize: fonts.body,
    fontWeight: '800',
    color: colors.blue,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: 12,
    paddingBottom: 16,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colon: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.ink,
    marginTop: 28,
  },
  section: {
    fontSize: fonts.title,
    fontWeight: '800',
    color: colors.ink,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 48,
    minWidth: 72,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  chipText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
  },
  chipTextOn: {
    color: '#fff',
  },
  days: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  day: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayOn: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  dayText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
  },
  dayTextOn: {
    color: '#fff',
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  volumeBtn: {
    width: 56,
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volumeBtnText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
  },
  volumeValue: {
    width: 44,
    textAlign: 'center',
    fontSize: 36,
    fontWeight: '800',
    color: colors.ink,
  },
  preview: {
    flex: 1,
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: colors.amberDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: {
    color: '#fff',
    fontSize: fonts.button,
    fontWeight: '800',
  },
});
