jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  FileSystemSessionType: { BACKGROUND: 0, FOREGROUND: 1 },
  createDownloadResumable: jest.fn(() => ({
    downloadAsync: jest.fn(async () => ({ uri: 'file:///mock.partial', status: 200 })),
  })),
}));
