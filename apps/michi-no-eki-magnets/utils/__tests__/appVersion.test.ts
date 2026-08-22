import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { getAppVersionInfo } from '../appVersion';

jest.mock('expo-constants', () => ({
  expoConfig: {
    version: '1.4.2',
    ios: { buildNumber: '15' },
    android: { versionCode: 52 },
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
      version: '1.4.2',
      ios: { buildNumber: '15' },
      android: { versionCode: 52 },
    };
  });

  it('returns iOS version and build number', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'ios',
    });

    expect(getAppVersionInfo()).toEqual({
      version: '1.4.2',
      build: '15',
    });
  });

  it('returns Android version and versionCode', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });

    expect(getAppVersionInfo()).toEqual({
      version: '1.4.2',
      build: '52',
    });
  });

  it('falls back to native build when config build is missing', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'ios',
    });
    (Constants as { expoConfig: unknown }).expoConfig = {
      version: '1.4.2',
      ios: {},
    };

    expect(getAppVersionInfo()).toEqual({
      version: '1.4.2',
      build: '99',
    });
  });
});
