import { createAlarm } from '../alarmLogic';
import {
  parseAlarm,
  parseAlarms,
  parseSettings,
  serializeAlarms,
  serializeSettings,
} from '../alarmStorage';

describe('alarmStorage', () => {
  it('round-trips alarms and skips invalid rows', () => {
    const alarms = [
      createAlarm({
        id: 'a1',
        hour: 7,
        minute: 30,
        volume: 0.6,
        label: '起床',
        repeat: { type: 'weekdays' },
      }),
      createAlarm({
        id: 'a2',
        hour: 21,
        minute: 0,
        enabled: false,
        repeat: { type: 'custom', days: [0, 6] },
      }),
    ];

    const raw = serializeAlarms(alarms);
    expect(parseAlarms(raw)).toEqual(alarms);
    expect(parseAlarms(null)).toEqual([]);
    expect(parseAlarms('{')).toEqual([]);
    expect(parseAlarms('{"no":"array"}')).toEqual([]);
    expect(parseAlarm({ id: 'ok', hour: 99, minute: -3, enabled: false })).toMatchObject({
      id: 'ok',
      hour: 23,
      minute: 0,
      enabled: false,
      repeat: { type: 'daily' },
    });
    expect(parseAlarm({ hour: 7 })).toBeNull();
    expect(parseAlarm({ id: 'c1', repeat: { type: 'custom', days: [0, 8, 6] } })?.repeat).toEqual({
      type: 'custom',
      days: [0, 6],
    });
  });

  it('parses settings with keep-screen-on defaulting to false', () => {
    expect(parseSettings(null)).toEqual({ keepScreenOn: false });
    expect(parseSettings('null')).toEqual({ keepScreenOn: false });
    expect(parseSettings('{')).toEqual({ keepScreenOn: false });
    expect(parseSettings(serializeSettings({ keepScreenOn: false }))).toEqual({
      keepScreenOn: false,
    });
    expect(parseSettings('{"keepScreenOn":true}')).toEqual({ keepScreenOn: true });
  });
});
