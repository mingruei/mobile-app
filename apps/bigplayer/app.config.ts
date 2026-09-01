import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'BigPlayer',
  slug: 'bigplayer',
  version: '1.0.0',
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'bigplayer',
  splash: {
    image: './assets/icon.png',
    backgroundColor: '#0F5FA0',
  },
  plugins: [
    [
      'expo-av',
      {
        microphonePermission: false,
      },
    ],
    'expo-file-system',
    [
      'expo-build-properties',
      {
        ios: {
          deploymentTarget: '15.1',
        },
      },
    ],
    './plugins/withFmtXcode26Fix.js',
    './plugins/withIosDisplayName.js',
    './plugins/withReleaseRunScheme.js',
    './plugins/withIosVersion.js',
  ],
  ios: {
    supportsTablet: true,
    requireFullScreen: true,
    bundleIdentifier: 'com.invisibleworksop.bigplayer',
    buildNumber: '3',
    appleTeamId: 'VHX5NF3JWK',
    infoPlist: {
      UIFileSharingEnabled: true,
      LSSupportsOpeningDocumentsInPlace: true,
      UISupportsDocumentBrowser: true,
      ITSAppUsesNonExemptEncryption: false,
      UISupportedInterfaceOrientations: ['UIInterfaceOrientationPortrait'],
      'UISupportedInterfaceOrientations~ipad': [
        'UIInterfaceOrientationPortrait',
        'UIInterfaceOrientationPortraitUpsideDown',
        'UIInterfaceOrientationLandscapeLeft',
        'UIInterfaceOrientationLandscapeRight',
      ],
      CFBundleDocumentTypes: [
        {
          CFBundleTypeName: 'Audio',
          CFBundleTypeRole: 'Viewer',
          LSHandlerRank: 'Alternate',
          LSItemContentTypes: [
            'public.audio',
            'public.mp3',
            'public.mpeg-4-audio',
            'public.aac-audio',
            'com.apple.m4a-audio',
            'public.mpeg-4',
          ],
        },
      ],
    },
  },
  android: {
    package: 'com.invisibleworksop.bigplayer',
    versionCode: 3,
    adaptiveIcon: {
      backgroundColor: '#0F5FA0',
      foregroundImage: './assets/icon.png',
    },
  },
};

export default config;
