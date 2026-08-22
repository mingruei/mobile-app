import { Platform } from 'react-native';
import Constants from 'expo-constants';

export type AppVersionInfo = {
  version: string;
  build: string;
};

export function getAppVersionInfo(): AppVersionInfo {
  const expoConfig = Constants.expoConfig;
  const version =
    expoConfig?.version?.trim() ||
    Constants.nativeAppVersion?.trim() ||
    '—';

  if (Platform.OS === 'ios') {
    const build =
      expoConfig?.ios?.buildNumber?.trim() ||
      Constants.nativeBuildVersion?.trim() ||
      '—';
    return { version, build };
  }

  const versionCode = expoConfig?.android?.versionCode;
  const build =
    versionCode != null
      ? String(versionCode)
      : Constants.nativeBuildVersion?.trim() || '—';

  return { version, build };
}
