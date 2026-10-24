import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import type { Alarm, Settings } from '../types/alarm';
import {
  DEFAULT_SETTINGS,
  createAlarm,
  fireKey,
  hasEnabledAlarm,
  matchesAlarmTime,
  sortAlarms,
} from '../utils/alarmLogic';
import {
  alarmIdFromNotificationData,
  requestAlarmPermission,
  syncAlarmNotifications,
} from '../utils/alarmNotifications';
import {
  startAlarmSound,
  startBackgroundKeepAlive,
  stopAlarmSound,
  stopBackgroundKeepAlive,
} from '../utils/alarmSound';
import {
  ALARMS_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  parseAlarms,
  parseSettings,
  serializeAlarms,
  serializeSettings,
} from '../utils/alarmStorage';

export function useEasyAlarm() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [editor, setEditor] = useState<Alarm | null>(null);
  const [ringing, setRinging] = useState<Alarm | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [permissionGranted, setPermissionGranted] = useState(true);
  const firedRef = useRef(new Set<string>());
  const ringingRef = useRef<Alarm | null>(null);
  const alarmsRef = useRef<Alarm[]>([]);

  ringingRef.current = ringing;
  alarmsRef.current = alarms;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [alarmsRaw, settingsRaw, granted] = await Promise.all([
        AsyncStorage.getItem(ALARMS_STORAGE_KEY),
        AsyncStorage.getItem(SETTINGS_STORAGE_KEY),
        requestAlarmPermission(),
      ]);
      if (cancelled) return;
      const loaded = sortAlarms(parseAlarms(alarmsRaw));
      setAlarms(loaded);
      setSettings(parseSettings(settingsRaw));
      setPermissionGranted(granted);
      await syncAlarmNotifications(loaded);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(new Date());
    });
    return () => {
      clearInterval(timer);
      appState.remove();
    };
  }, []);

  const persistAlarms = useCallback(async (next: Alarm[]) => {
    const sorted = sortAlarms(next);
    setAlarms(sorted);
    await AsyncStorage.setItem(ALARMS_STORAGE_KEY, serializeAlarms(sorted));
    await syncAlarmNotifications(sorted);
    return sorted;
  }, []);

  const persistSettings = useCallback(async (next: Settings) => {
    setSettings(next);
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, serializeSettings(next));
  }, []);

  const beginRinging = useCallback(async (alarm: Alarm) => {
    if (ringingRef.current?.id === alarm.id) return;
    firedRef.current.add(fireKey(alarm.id, new Date()));
    setRinging(alarm);
    setEditor(null);
    await startAlarmSound(alarm.volume);
  }, []);

  const dismissRinging = useCallback(async () => {
    const current = ringingRef.current;
    await stopAlarmSound();
    setRinging(null);
    if (!current) return;
    if (current.repeat.type === 'once') {
      await persistAlarms(
        alarmsRef.current.map((alarm) =>
          alarm.id === current.id ? { ...alarm, enabled: false } : alarm,
        ),
      );
      return;
    }
    await syncAlarmNotifications(alarmsRef.current);
  }, [persistAlarms]);

  useEffect(() => {
    if (!ready || ringing) return;
    for (const alarm of alarms) {
      const key = fireKey(alarm.id, now);
      if (firedRef.current.has(key)) continue;
      if (matchesAlarmTime(alarm, now)) {
        void beginRinging(alarm);
        break;
      }
    }
  }, [alarms, beginRinging, now, ready, ringing]);

  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener((notification) => {
      const alarmId = alarmIdFromNotificationData(notification.request.content.data);
      const alarm = alarmsRef.current.find((item) => item.id === alarmId) ?? null;
      if (alarm) void beginRinging(alarm);
    });
    const response = Notifications.addNotificationResponseReceivedListener((event) => {
      const alarmId = alarmIdFromNotificationData(event.notification.request.content.data);
      const alarm = alarmsRef.current.find((item) => item.id === alarmId) ?? null;
      if (alarm) void beginRinging(alarm);
      Notifications.clearLastNotificationResponse();
    });
    return () => {
      received.remove();
      response.remove();
    };
  }, [beginRinging]);

  useEffect(() => {
    if (!ready) return;
    void Notifications.getLastNotificationResponseAsync().then((event) => {
      const alarmId = alarmIdFromNotificationData(event?.notification.request.content.data);
      const alarm = alarmsRef.current.find((item) => item.id === alarmId) ?? null;
      if (alarm) void beginRinging(alarm);
      Notifications.clearLastNotificationResponse();
    });
  }, [beginRinging, ready]);

  useEffect(() => {
    if (!ready || ringing) return;
    if (hasEnabledAlarm(alarms)) {
      void startBackgroundKeepAlive();
      return;
    }
    void stopBackgroundKeepAlive();
  }, [alarms, ready, ringing]);

  useEffect(() => {
    const shouldKeepAwake = settings.keepScreenOn || ringing !== null;
    if (shouldKeepAwake) {
      void activateKeepAwakeAsync('easy-alarm');
    } else {
      void deactivateKeepAwake('easy-alarm');
    }
    return () => {
      void deactivateKeepAwake('easy-alarm');
    };
  }, [ringing, settings.keepScreenOn]);

  const openNew = useCallback(() => {
    setEditor(createAlarm());
  }, []);

  const openExisting = useCallback((alarm: Alarm) => {
    setEditor(alarm);
  }, []);

  const closeEditor = useCallback(() => {
    setEditor(null);
  }, []);

  const saveEditor = useCallback(
    async (draft: Alarm) => {
      const exists = alarmsRef.current.some((alarm) => alarm.id === draft.id);
      const next = exists
        ? alarmsRef.current.map((alarm) => (alarm.id === draft.id ? draft : alarm))
        : [...alarmsRef.current, draft];
      await persistAlarms(next);
      setEditor(null);
    },
    [persistAlarms],
  );

  const deleteEditor = useCallback(
    async (id: string) => {
      await persistAlarms(alarmsRef.current.filter((alarm) => alarm.id !== id));
      setEditor(null);
    },
    [persistAlarms],
  );

  const toggleEnabled = useCallback(
    async (id: string) => {
      await persistAlarms(
        alarmsRef.current.map((alarm) =>
          alarm.id === id ? { ...alarm, enabled: !alarm.enabled } : alarm,
        ),
      );
    },
    [persistAlarms],
  );

  const toggleKeepScreenOn = useCallback(async () => {
    await persistSettings({ keepScreenOn: !settings.keepScreenOn });
  }, [persistSettings, settings.keepScreenOn]);

  return {
    alarms,
    settings,
    ready,
    editor,
    ringing,
    now,
    permissionGranted,
    openNew,
    openExisting,
    closeEditor,
    saveEditor,
    deleteEditor,
    toggleEnabled,
    toggleKeepScreenOn,
    dismissRinging,
  };
}
