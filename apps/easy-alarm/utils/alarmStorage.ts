import type { Alarm, RepeatRule, Settings, Weekday } from '../types/alarm';
import {
  ALL_DAYS,
  DEFAULT_SETTINGS,
  clampHour,
  clampMinute,
  clampVolume,
  createAlarm,
  isWeekdayValue,
  normalizeRepeat,
} from './alarmLogic';

export const ALARMS_STORAGE_KEY = 'easy-alarm.alarms';
export const SETTINGS_STORAGE_KEY = 'easy-alarm.settings';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseRepeat(value: unknown): RepeatRule {
  const record = asRecord(value);
  const type = record?.type;
  if (type === 'once' || type === 'daily' || type === 'weekdays' || type === 'weekends') {
    return { type };
  }
  if (type === 'custom' && record) {
    const rawDays = Array.isArray(record.days) ? record.days : [];
    const days = rawDays.filter((day): day is Weekday => typeof day === 'number' && isWeekdayValue(day));
    return normalizeRepeat({ type: 'custom', days: days.length > 0 ? days : ALL_DAYS.slice(1, 6) });
  }
  return { type: 'daily' };
}

export function parseAlarm(value: unknown): Alarm | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== 'string' || record.id.length === 0) {
    return null;
  }
  return createAlarm({
    id: record.id,
    hour: typeof record.hour === 'number' ? record.hour : 7,
    minute: typeof record.minute === 'number' ? record.minute : 0,
    enabled: record.enabled !== false,
    volume: typeof record.volume === 'number' ? clampVolume(record.volume) : undefined,
    label: typeof record.label === 'string' ? record.label : '',
    repeat: parseRepeat(record.repeat),
  });
}

export function parseAlarms(raw: string | null): Alarm[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(parseAlarm).filter((alarm): alarm is Alarm => alarm !== null);
  } catch {
    return [];
  }
}

export function serializeAlarms(alarms: Alarm[]): string {
  return JSON.stringify(
    alarms.map((alarm) => ({
      id: alarm.id,
      hour: clampHour(alarm.hour),
      minute: clampMinute(alarm.minute),
      enabled: alarm.enabled,
      volume: clampVolume(alarm.volume),
      label: alarm.label,
      repeat: normalizeRepeat(alarm.repeat),
    })),
  );
}

export function parseSettings(raw: string | null): Settings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = asRecord(JSON.parse(raw) as unknown);
    if (!parsed) return { ...DEFAULT_SETTINGS };
    return {
      keepScreenOn: parsed.keepScreenOn === true,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function serializeSettings(settings: Settings): string {
  return JSON.stringify({
    keepScreenOn: settings.keepScreenOn,
  });
}
