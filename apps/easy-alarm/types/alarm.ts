export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type RepeatRule =
  | { type: 'once' }
  | { type: 'daily' }
  | { type: 'weekdays' }
  | { type: 'weekends' }
  | { type: 'custom'; days: Weekday[] };

export type Alarm = {
  id: string;
  hour: number;
  minute: number;
  enabled: boolean;
  volume: number;
  label: string;
  repeat: RepeatRule;
};

export type Settings = {
  keepScreenOn: boolean;
};

export type CalendarAlarmTrigger = {
  kind: 'calendar';
  hour: number;
  minute: number;
  weekday?: number;
  repeats: true;
};

export type DateAlarmTrigger = {
  kind: 'date';
  date: Date;
};

export type AlarmNotificationPlan = {
  identifier: string;
  title: string;
  body: string;
  alarmId: string;
  trigger: CalendarAlarmTrigger | DateAlarmTrigger;
};
