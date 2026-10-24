import type { RepeatRule } from '../../types/alarm';
import {
  alarmIdFromNotificationData,
  alarmTitle,
  FOLLOW_UP_COUNT,
  FOLLOW_UP_INTERVAL_MS,
  buildFollowUpPlans,
  buildNotificationPlans,
  hasEnabledAlarm,
  resolveDays,
  clampHour,
  clampMinute,
  clampVolume,
  createAlarm,
  fireKey,
  formatClock,
  formatRepeat,
  formatTime,
  matchesAlarmTime,
  nextFireDate,
  notificationIdsForAlarms,
  sortAlarms,
  stepHour,
  stepMinute,
  stepVolume,
  toggleCustomDay,
  toIosWeekday,
  volumeLevel,
} from '../alarmLogic';

function at(iso: string): Date {
  return new Date(iso);
}

describe('alarmLogic', () => {
  it('clamps and steps time and volume', () => {
    expect(clampHour(25)).toBe(23);
    expect(clampHour(-1)).toBe(0);
    expect(clampHour(Number.NaN)).toBe(0);
    expect(clampMinute(99)).toBe(59);
    expect(clampMinute(Number.NaN)).toBe(0);
    expect(clampVolume(Number.NaN)).toBe(0.8);
    expect(clampVolume(0)).toBe(0.1);
    expect(clampVolume(2)).toBe(1);
    expect(stepHour(23, 1)).toBe(0);
    expect(stepHour(0, -1)).toBe(23);
    expect(stepMinute(59, 1)).toBe(0);
    expect(stepMinute(0, -1)).toBe(59);
    expect(stepVolume(1, 0.1)).toBe(1);
    expect(stepVolume(0.1, -0.1)).toBe(0.1);
    expect(volumeLevel(0.8)).toBe(8);
  });

  it('formats time, clock, titles, and repeat labels', () => {
    expect(formatTime(7, 5)).toBe('07:05');
    expect(formatClock(at('2026-09-13T14:03:00'))).toBe('14:03');
    expect(formatRepeat({ type: 'once' })).toBe('一次');
    expect(formatRepeat({ type: 'daily' })).toBe('每天');
    expect(formatRepeat({ type: 'weekdays' })).toBe('平日');
    expect(formatRepeat({ type: 'weekends' })).toBe('週末');
    expect(formatRepeat({ type: 'custom', days: [1, 3, 5] })).toBe('週一、週三、週五');
    expect(formatRepeat({ type: 'custom', days: [0, 1, 2, 3, 4, 5, 6] })).toBe('每天');
    expect(formatRepeat({ type: 'mystery' } as RepeatRule)).toBe('每天');
    expect(resolveDays({ type: 'mystery' } as RepeatRule)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(alarmTitle(createAlarm({ label: ' 吃藥 ' }))).toBe('吃藥');
    expect(alarmTitle(createAlarm({ label: '   ' }))).toBe('鬧鐘');
  });

  it('finds the next fire time for once, daily, and weekly rules', () => {
    const sundayAfternoon = at('2026-09-13T14:00:00');

    expect(
      nextFireDate(createAlarm({ hour: 14, minute: 30, repeat: { type: 'daily' } }), sundayAfternoon),
    ).toEqual(at('2026-09-13T14:30:00'));

    expect(
      nextFireDate(createAlarm({ hour: 13, minute: 0, repeat: { type: 'daily' } }), sundayAfternoon),
    ).toEqual(at('2026-09-14T13:00:00'));

    expect(
      nextFireDate(createAlarm({ hour: 8, minute: 0, repeat: { type: 'weekdays' } }), sundayAfternoon),
    ).toEqual(at('2026-09-14T08:00:00'));

    expect(
      nextFireDate(createAlarm({ hour: 8, minute: 0, repeat: { type: 'weekends' } }), sundayAfternoon),
    ).toEqual(at('2026-09-19T08:00:00'));

    expect(
      nextFireDate(createAlarm({ hour: 15, minute: 0, repeat: { type: 'once' } }), sundayAfternoon),
    ).toEqual(at('2026-09-13T15:00:00'));

    expect(
      nextFireDate(createAlarm({ hour: 10, minute: 0, repeat: { type: 'once' } }), sundayAfternoon),
    ).toEqual(at('2026-09-14T10:00:00'));

    expect(
      nextFireDate(
        createAlarm({ enabled: false, hour: 15, minute: 0, repeat: { type: 'daily' } }),
        sundayAfternoon,
      ),
    ).toBeNull();
  });

  it('matches the current minute only on allowed days', () => {
    const sunday1430 = at('2026-09-13T14:30:10');
    const daily = createAlarm({ hour: 14, minute: 30, repeat: { type: 'daily' } });
    const weekdays = createAlarm({ hour: 14, minute: 30, repeat: { type: 'weekdays' } });
    const once = createAlarm({ hour: 14, minute: 30, repeat: { type: 'once' } });

    expect(matchesAlarmTime(daily, sunday1430)).toBe(true);
    expect(matchesAlarmTime(weekdays, sunday1430)).toBe(false);
    expect(matchesAlarmTime(once, sunday1430)).toBe(true);
    expect(matchesAlarmTime(daily, at('2026-09-13T14:31:00'))).toBe(false);
    expect(fireKey('abc', sunday1430)).toBe('abc-2026-09-13-14-30');
  });

  it('builds iOS notification plans for once, daily, and selected days', () => {
    const now = at('2026-09-13T14:00:00');
    const once = createAlarm({
      id: 'once1',
      hour: 15,
      minute: 0,
      label: '喝茶',
      repeat: { type: 'once' },
    });
    const daily = createAlarm({ id: 'day1', hour: 7, minute: 0, repeat: { type: 'daily' } });
    const custom = createAlarm({
      id: 'cus1',
      hour: 21,
      minute: 15,
      repeat: { type: 'custom', days: [1, 4] },
    });

    expect(buildNotificationPlans(once, now)).toEqual([
      {
        identifier: 'alarm-once1-once',
        title: '喝茶',
        body: '鬧鐘響了，點一下就能關掉',
        alarmId: 'once1',
        trigger: { kind: 'date', date: at('2026-09-13T15:00:00') },
      },
    ]);

    expect(buildNotificationPlans(daily, now)).toEqual([
      {
        identifier: 'alarm-day1-daily',
        title: '鬧鐘',
        body: '鬧鐘響了，點一下就能關掉',
        alarmId: 'day1',
        trigger: { kind: 'calendar', hour: 7, minute: 0, repeats: true },
      },
    ]);

    const customPlans = buildNotificationPlans(custom, now);
    expect(customPlans.map((plan) => plan.identifier)).toEqual(['alarm-cus1-d1', 'alarm-cus1-d4']);
    expect(customPlans[0]?.trigger).toEqual({
      kind: 'calendar',
      hour: 21,
      minute: 15,
      weekday: 2,
      repeats: true,
    });
    expect(toIosWeekday(0)).toBe(1);
    expect(toIosWeekday(6)).toBe(7);
    expect(
      notificationIdsForAlarms([once, daily], now).filter((id) => !id.includes('-fu')),
    ).toEqual(['alarm-once1-once', 'alarm-day1-daily']);
  });

  it('schedules follow-up notifications so a background alarm keeps ringing', () => {
    const now = at('2026-09-13T14:00:00');
    const alarm = createAlarm({
      id: 'once1',
      hour: 15,
      minute: 0,
      repeat: { type: 'once' },
    });
    const followUps = buildFollowUpPlans(alarm, now);
    expect(followUps).toHaveLength(FOLLOW_UP_COUNT);
    expect(followUps[0]).toEqual({
      identifier: 'alarm-once1-fu1',
      title: '鬧鐘',
      body: '鬧鐘響了，點一下就能關掉',
      alarmId: 'once1',
      trigger: {
        kind: 'date',
        date: new Date(at('2026-09-13T15:00:00').getTime() + FOLLOW_UP_INTERVAL_MS),
      },
    });
    expect(followUps[7]?.identifier).toBe('alarm-once1-fu8');
    expect(buildFollowUpPlans(createAlarm({ enabled: false }), now)).toEqual([]);
    expect(hasEnabledAlarm([alarm])).toBe(true);
    expect(hasEnabledAlarm([createAlarm({ enabled: false })])).toBe(false);
    expect(hasEnabledAlarm([])).toBe(false);
  });

  it('sorts alarms and fills empty custom days with weekdays', () => {
    const later = createAlarm({ id: 'b', hour: 9, minute: 0 });
    const earlier = createAlarm({ id: 'a', hour: 6, minute: 5 });
    const sameTimeZ = createAlarm({ id: 'z', hour: 6, minute: 5 });
    expect(sortAlarms([later, sameTimeZ, earlier]).map((alarm) => alarm.id)).toEqual([
      'a',
      'z',
      'b',
    ]);
    expect(createAlarm({ repeat: { type: 'custom', days: [] } }).repeat).toEqual({
      type: 'custom',
      days: [1, 2, 3, 4, 5],
    });
    expect(buildNotificationPlans(createAlarm({ enabled: false }), new Date())).toEqual([]);
  });

  it('toggles custom weekdays without allowing an empty set', () => {
    expect(toggleCustomDay([1, 3], 5)).toEqual([1, 3, 5]);
    expect(toggleCustomDay([1, 3], 1)).toEqual([3]);
    expect(toggleCustomDay([3], 3)).toEqual([3]);
  });

  it('reads alarm ids from notification data', () => {
    expect(alarmIdFromNotificationData({ alarmId: 'a1' })).toBe('a1');
    expect(alarmIdFromNotificationData({ alarmId: '' })).toBeNull();
    expect(alarmIdFromNotificationData(null)).toBeNull();
    expect(alarmIdFromNotificationData('a1')).toBeNull();
  });
});
