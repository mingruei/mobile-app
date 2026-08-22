import type { ExpoConfig } from 'expo/config';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const permissionMessages = require('./plugins/permissionMessages') as {
  location: string;
  photo: string;
  camera: string;
};

const isProductionBuild = process.env.EAS_BUILD_PROFILE === 'production';

const config: ExpoConfig = {
  name: '攻城師',
  slug: 'japan-castles-map',
  version: '1.4.3',
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  androidNavigationBar: {
    enforceContrast: false,
  },
  scheme: 'japan-castles-map',
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
        // App only picks/captures still images for 御城印 / 城卡 — no video/audio.
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
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          enablePngCrunchInReleaseBuilds: true,
        },
        ios: {
          deploymentTarget: '16.4',
          buildReactNativeFromSource: true,
        },
      },
    ],
    './plugins/withAndroidPlayCompliance.js',
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
    bundleIdentifier: 'com.japancastles.map',
    buildNumber: '16',
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
    package: 'com.japancastles.map',
    versionCode: 57,
    allowBackup: true,
    softwareKeyboardLayoutMode: 'resize',
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'CAMERA',
    ],
    blockedPermissions: [
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
    adaptiveIcon: {
      backgroundColor: '#1A2744',
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
  },
};

export default config;
