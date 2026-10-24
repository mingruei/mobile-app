import * as Notifications from 'expo-notifications';
import type { Alarm } from '../types/alarm';
import { alarmIdFromNotificationData, buildAllNotificationPlans } from './alarmLogic';

export { alarmIdFromNotificationData };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestAlarmPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  const next = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowSound: true,
      allowBadge: false,
    },
  });
  return next.status === 'granted';
}

export async function syncAlarmNotifications(alarms: Alarm[], now = new Date()): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  for (const plan of buildAllNotificationPlans(alarms, now)) {
    await Notifications.scheduleNotificationAsync({
      identifier: plan.identifier,
      content: {
        title: plan.title,
        body: plan.body,
        sound: 'alarm.wav',
        data: { alarmId: plan.alarmId },
        interruptionLevel: 'timeSensitive',
      },
      trigger:
        plan.trigger.kind === 'date'
          ? {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: plan.trigger.date,
            }
          : {
              type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
              hour: plan.trigger.hour,
              minute: plan.trigger.minute,
              weekday: plan.trigger.weekday,
              repeats: true,
            },
    });
  }
}

