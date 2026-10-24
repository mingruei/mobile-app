import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'AudioFlow',
  slug: 'my-podcast',
  version: '1.0.3',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'my-podcast',
  splash: {
    image: './assets/icon-source.png',
    backgroundColor: '#F1F4F7',
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
          deploymentTarget: '16.0',
        },
      },
    ],
    './plugins/withFmtXcode26Fix.js',
    './plugins/withIosSceneLifecycle.js',
    '@bacons/apple-targets',
  ],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.invisibleworksop.mypodcast',
    buildNumber: '20',
    appleTeamId: 'VHX5NF3JWK',
    infoPlist: {
      CFBundleDisplayName: '奧笛流',
      ITSAppUsesNonExemptEncryption: false,
      UIBackgroundModes: ['audio'],
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
      },
      UIApplicationSceneManifest: {
        UIApplicationSupportsMultipleScenes: false,
        UISceneConfigurations: {
          UIWindowSceneSessionRoleApplication: [
            {
              UISceneConfigurationName: 'Default Configuration',
              UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
            },
          ],
        },
      },
      UISupportedInterfaceOrientations: ['UIInterfaceOrientationPortrait'],
    },
  },
};

export default config;
