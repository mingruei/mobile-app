import { alarmIdFromNotificationData } from '../alarmNotifications';

describe('alarmNotifications', () => {
  it('re-exports notification data parsing', () => {
    expect(alarmIdFromNotificationData({ alarmId: 'x' })).toBe('x');
  });
});
