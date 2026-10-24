import type {
  Alarm,
  AlarmNotificationPlan,
  RepeatRule,
  Settings,
  Weekday,
} from '../types/alarm';

export const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'] as const;
export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5];
export const WEEKENDS: Weekday[] = [0, 6];
export const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export const DEFAULT_VOLUME = 0.8;
export const VOLUME_STEP = 0.1;
export const DEFAULT_SETTINGS: Settings = { keepScreenOn: false };
export const FOLLOW_UP_COUNT = 8;
export const FOLLOW_UP_INTERVAL_MS = 30_000;

export const RING_HINT = '請點畫面任何位置關掉鬧鐘';
export const NOTIFICATION_BODY = '鬧鐘響了，點一下就能關掉';

export function clampHour(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(23, Math.max(0, Math.trunc(value)));
}

export function clampMinute(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(59, Math.max(0, Math.trunc(value)));
}

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VOLUME;
  const snapped = Math.round(value / VOLUME_STEP) * VOLUME_STEP;
  return Math.min(1, Math.max(0.1, Number(snapped.toFixed(1))));
}

export function stepHour(hour: number, delta: number): number {
  return ((clampHour(hour) + delta) % 24 + 24) % 24;
}

export function stepMinute(minute: number, delta: number): number {
  return ((clampMinute(minute) + delta) % 60 + 60) % 60;
}

export function stepVolume(volume: number, delta: number): number {
  return clampVolume(volume + delta);
}

export function volumeLevel(volume: number): number {
  return Math.round(clampVolume(volume) * 10);
}

export function createAlarmId(nowMs = Date.now(), random = Math.random()): string {
  return `a-${nowMs.toString(36)}-${Math.floor(random * 1e6).toString(36)}`;
}

export function createAlarm(overrides: Partial<Alarm> = {}): Alarm {
  return {
    id: overrides.id ?? createAlarmId(),
    hour: clampHour(overrides.hour ?? 7),
    minute: clampMinute(overrides.minute ?? 0),
    enabled: overrides.enabled ?? true,
    volume: clampVolume(overrides.volume ?? DEFAULT_VOLUME),
    label: (overrides.label ?? '').trim(),
    repeat: normalizeRepeat(overrides.repeat ?? { type: 'daily' }),
  };
}

export function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatTime(hour: number, minute: number): string {
  return `${pad2(clampHour(hour))}:${pad2(clampMinute(minute))}`;
}

export function formatClock(now: Date): string {
  return formatTime(now.getHours(), now.getMinutes());
}

export function resolveDays(repeat: RepeatRule): Weekday[] | null {
  switch (repeat.type) {
    case 'once':
      return null;
    case 'daily':
      return ALL_DAYS;
    case 'weekdays':
      return WEEKDAYS;
    case 'weekends':
      return WEEKENDS;
    case 'custom': {
      const unique = [...new Set(repeat.days.filter(isWeekday))].sort((a, b) => a - b);
      return unique.length > 0 ? unique : WEEKDAYS;
    }
    default:
      return ALL_DAYS;
  }
}

export function normalizeRepeat(repeat: RepeatRule): RepeatRule {
  if (repeat.type === 'custom') {
    return { type: 'custom', days: resolveDays(repeat) ?? WEEKDAYS };
  }
  return { type: repeat.type };
}

export function formatRepeat(repeat: RepeatRule): string {
  switch (repeat.type) {
    case 'once':
      return '一次';
    case 'daily':
      return '每天';
    case 'weekdays':
      return '平日';
    case 'weekends':
      return '週末';
    case 'custom': {
      const days = resolveDays(repeat) ?? [];
      if (days.length === 7) return '每天';
      return days.map((day) => `週${WEEKDAY_LABELS[day]}`).join('、');
    }
    default:
      return '每天';
  }
}

export function alarmTitle(alarm: Alarm): string {
  return alarm.label.trim() || '鬧鐘';
}

export function nextFireDate(alarm: Alarm, now: Date): Date | null {
  if (!alarm.enabled) return null;

  const days = resolveDays(alarm.repeat);
  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(now);
    candidate.setSeconds(0, 0);
    candidate.setMilliseconds(0);
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(alarm.hour, alarm.minute, 0, 0);
    if (candidate <= now) continue;
    if (days === null || days.includes(candidate.getDay() as Weekday)) {
      return candidate;
    }
  }
  return null;
}

export function matchesAlarmTime(alarm: Alarm, now: Date): boolean {
  if (!alarm.enabled) return false;
  if (now.getHours() !== alarm.hour || now.getMinutes() !== alarm.minute) {
    return false;
  }
  const days = resolveDays(alarm.repeat);
  return days === null || days.includes(now.getDay() as Weekday);
}

export function fireKey(alarmId: string, now: Date): string {
  return [
    alarmId,
    now.getFullYear(),
    pad2(now.getMonth() + 1),
    pad2(now.getDate()),
    pad2(now.getHours()),
    pad2(now.getMinutes()),
  ].join('-');
}

export function toIosWeekday(day: Weekday): number {
  return day + 1;
}

export function buildNotificationPlans(alarm: Alarm, now: Date): AlarmNotificationPlan[] {
  if (!alarm.enabled) return [];

  const title = alarmTitle(alarm);
  const base = {
    title,
    body: NOTIFICATION_BODY,
    alarmId: alarm.id,
  };

  if (alarm.repeat.type === 'once') {
    const date = nextFireDate(alarm, now);
    if (!date) return [];
    return [
      {
        ...base,
        identifier: `alarm-${alarm.id}-once`,
        trigger: { kind: 'date', date },
      },
    ];
  }

  const days = resolveDays(alarm.repeat) ?? ALL_DAYS;
  if (days.length === 7) {
    return [
      {
        ...base,
        identifier: `alarm-${alarm.id}-daily`,
        trigger: {
          kind: 'calendar',
          hour: alarm.hour,
          minute: alarm.minute,
          repeats: true,
        },
      },
    ];
  }

  return days.map((day) => ({
    ...base,
    identifier: `alarm-${alarm.id}-d${day}`,
    trigger: {
      kind: 'calendar',
      hour: alarm.hour,
      minute: alarm.minute,
      weekday: toIosWeekday(day),
      repeats: true as const,
    },
  }));
}

export function buildFollowUpPlans(alarm: Alarm, now: Date): AlarmNotificationPlan[] {
  if (!alarm.enabled) return [];
  const fireAt = nextFireDate(alarm, now);
  if (!fireAt) return [];
  return Array.from({ length: FOLLOW_UP_COUNT }, (_, index) => ({
    identifier: `alarm-${alarm.id}-fu${index + 1}`,
    title: alarmTitle(alarm),
    body: NOTIFICATION_BODY,
    alarmId: alarm.id,
    trigger: {
      kind: 'date' as const,
      date: new Date(fireAt.getTime() + (index + 1) * FOLLOW_UP_INTERVAL_MS),
    },
  }));
}

export function buildAllNotificationPlans(alarms: Alarm[], now: Date): AlarmNotificationPlan[] {
  return alarms.flatMap((alarm) => [
    ...buildNotificationPlans(alarm, now),
    ...buildFollowUpPlans(alarm, now),
  ]);
}

export function notificationIdsForAlarms(alarms: Alarm[], now: Date): string[] {
  return buildAllNotificationPlans(alarms, now).map((plan) => plan.identifier);
}

export function hasEnabledAlarm(alarms: Alarm[]): boolean {
  return alarms.some((alarm) => alarm.enabled);
}

function isWeekday(value: number): value is Weekday {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

export function isWeekdayValue(value: number): value is Weekday {
  return isWeekday(value);
}

export function toggleCustomDay(days: Weekday[], day: Weekday): Weekday[] {
  if (days.includes(day)) {
    const next = days.filter((item) => item !== day);
    return next.length > 0 ? next : days;
  }
  return [...days, day].sort((a, b) => a - b);
}

export function alarmIdFromNotificationData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const alarmId = (data as { alarmId?: unknown }).alarmId;
  return typeof alarmId === 'string' && alarmId.length > 0 ? alarmId : null;
}

export function sortAlarms(alarms: Alarm[]): Alarm[] {
  return [...alarms].sort((a, b) => {
    if (a.hour !== b.hour) return a.hour - b.hour;
    if (a.minute !== b.minute) return a.minute - b.minute;
    return a.id.localeCompare(b.id);
  });
}
