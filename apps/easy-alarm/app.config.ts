import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: '簡易鬧鐘',
  slug: 'easy-alarm',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'easy-alarm',
  splash: {
    image: './assets/icon.png',
    backgroundColor: '#F2B705',
  },
  plugins: [
    [
      'expo-av',
      {
        microphonePermission: false,
      },
    ],
    [
      'expo-notifications',
      {
        sounds: ['./assets/alarm.wav'],
        mode: 'development',
      },
    ],
    [
      'expo-build-properties',
      {
        ios: {
          deploymentTarget: '16.0',
        },
      },
    ],
    './plugins/withFmtXcode26Fix.js',
  ],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.invisibleworksop.easyalarm',
    buildNumber: '1',
    appleTeamId: 'VHX5NF3JWK',
    infoPlist: {
      CFBundleDisplayName: '簡易鬧鐘',
      ITSAppUsesNonExemptEncryption: false,
      UIBackgroundModes: ['audio'],
      UISupportedInterfaceOrientations: ['UIInterfaceOrientationPortrait'],
    },
  },
};

export default config;
