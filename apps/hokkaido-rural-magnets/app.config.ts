import type { ExpoConfig } from 'expo/config';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const permissionMessages = require('./plugins/permissionMessages') as {
  location: string;
  photo: string;
  camera: string;
};

const isProductionBuild = process.env.EAS_BUILD_PROFILE === 'production';

const config: ExpoConfig = {
  name: '北海道鄉村標誌磁鐵收集帳',
  slug: 'hokkaido-rural-magnets',
  version: '1.0.0',
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'hokkaido-rural-magnets',
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
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.hokkaidorural.magnets',
    buildNumber: '4',
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
    package: 'com.hokkaidorural.magnets',
    versionCode: 4,
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
      backgroundColor: '#1A3A6E',
      foregroundImage: './assets/icon.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
  },
};

export default config;
