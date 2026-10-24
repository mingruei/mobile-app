jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(),
}));

jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn(async () => undefined),
    Sound: {
      createAsync: jest.fn(async () => ({
        sound: {
          playAsync: jest.fn(async () => undefined),
          stopAsync: jest.fn(async () => undefined),
          unloadAsync: jest.fn(async () => undefined),
          setVolumeAsync: jest.fn(async () => undefined),
          setIsLoopingAsync: jest.fn(async () => undefined),
        },
      })),
    },
    InterruptionModeIOS: { DoNotMix: 1 },
  },
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  scheduleNotificationAsync: jest.fn(async () => 'mock-id'),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponse: jest.fn(),
  SchedulableTriggerInputTypes: {
    DATE: 'date',
    CALENDAR: 'calendar',
  },
}));
