import type { ExpoConfig } from 'expo/config';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const permissionMessages = require('./plugins/permissionMessages') as {
  location: string;
  photo: string;
  camera: string;
};

const isProductionBuild = process.env.EAS_BUILD_PROFILE === 'production';

const config: ExpoConfig = {
  name: '日本道之駅磁鐵收集帳',
  slug: 'michi-no-eki-magnets',
  version: '1.0.1',
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'michi-no-eki-magnets',
  plugins: [
    ...(isProductionBuild ? [] : (['expo-dev-client'] as const)),
    'expo-screen-orientation',
    [
      'expo-location',
      {
        locationWhenInUsePermission: permissionMessages.location,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: permissionMessages.photo,
        cameraPermission: permissionMessages.camera,
        microphonePermission: false,
      },
    ],
    [
      'react-native-document-scanner-plugin',
      {
        cameraPermission: permissionMessages.camera,
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 36,
          targetSdkVersion: 36,
        },
        ios: {
          deploymentTarget: '16.4',
          buildReactNativeFromSource: true,
        },
      },
    ],
    './plugins/withFmtXcode26Fix.js',
    './plugins/withIosUsageDescriptions.js',
    './plugins/withHermesDsym.js',
    './plugins/withAndroidReleaseFileName.js',
    './plugins/withAndroidReleaseSigning.js',
    'expo-iap',
  ],
  extra: {
    eas: {
      projectId: 'a381aae1-a8d8-4d8f-9af8-47dc03fb19e4',
    },
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.michinoeki.magnets',
    buildNumber: '9',
    infoPlist: {
      NSLocationWhenInUseUsageDescription: permissionMessages.location,
      NSLocationAlwaysUsageDescription: permissionMessages.location,
      NSLocationAlwaysAndWhenInUseUsageDescription: permissionMessages.location,
      NSPhotoLibraryUsageDescription: permissionMessages.photo,
      NSCameraUsageDescription: permissionMessages.camera,
      LSApplicationQueriesSchemes: ['comgooglemaps', 'comgooglemapsurl', 'mailto'],
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.michinoeki.magnets',
    versionCode: 9,
    allowBackup: true,
    edgeToEdgeEnabled: true,
    softwareKeyboardLayoutMode: 'resize',
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'CAMERA',
      'READ_MEDIA_IMAGES',
      'READ_EXTERNAL_STORAGE',
    ],
    adaptiveIcon: {
      backgroundColor: '#FAF5E1',
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
  },
};

export default config;
