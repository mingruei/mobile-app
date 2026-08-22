import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { getAppVersionInfo } from '../appVersion';

jest.mock('expo-constants', () => ({
  expoConfig: {
    version: '1.4.3',
    ios: { buildNumber: '16' },
    android: { versionCode: 57 },
  },
  nativeAppVersion: '9.9.9',
  nativeBuildVersion: '99',
}));

describe('getAppVersionInfo', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalOS,
    });
    (Constants as { expoConfig: unknown }).expoConfig = {
      version: '1.4.3',
      ios: { buildNumber: '16' },
      android: { versionCode: 57 },
    };
  });

  it('returns iOS version and build number', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'ios',
    });

    expect(getAppVersionInfo()).toEqual({
      version: '1.4.3',
      build: '16',
    });
  });

  it('returns Android version and versionCode', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });

    expect(getAppVersionInfo()).toEqual({
      version: '1.4.3',
      build: '56',
    });
  });

  it('falls back to native build when config build is missing', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'ios',
    });
    (Constants as { expoConfig: unknown }).expoConfig = {
      version: '1.4.3',
      ios: {},
    };

    expect(getAppVersionInfo()).toEqual({
      version: '1.4.3',
      build: '99',
    });
  });
});
