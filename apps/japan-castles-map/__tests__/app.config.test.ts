import config from '../app.config';

describe('app.config', () => {
  it('defines user-facing and Android version metadata', () => {
    expect(config.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(config.android?.versionCode).toBeGreaterThan(0);
    expect(config.android?.versionCode).toBeGreaterThanOrEqual(40);
    expect(config.ios?.buildNumber).toBeTruthy();
  });

  it('includes required iOS permission usage descriptions', () => {
    const infoPlist = config.ios?.infoPlist ?? {};
    expect(infoPlist.NSLocationWhenInUseUsageDescription).toBeTruthy();
    expect(infoPlist.NSCameraUsageDescription).toBeTruthy();
    expect(infoPlist.NSPhotoLibraryUsageDescription).toBeTruthy();
    expect(infoPlist.NSMicrophoneUsageDescription).toBeUndefined();
  });

  it('blocks broad Android media storage permissions for Play policy compliance', () => {
    expect(config.android?.permissions).toEqual([
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'CAMERA',
    ]);
    expect(config.android?.blockedPermissions).toEqual(
      expect.arrayContaining([
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ]),
    );
  });

  it('disables expo-image-picker microphone permission', () => {
    const plugins = config.plugins ?? [];
    const imagePicker = plugins.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-image-picker',
    ) as [string, Record<string, unknown>] | undefined;

    expect(imagePicker?.[1]?.microphonePermission).toBe(false);
  });

  it('registers Play Console compliance plugins', () => {
    const plugins = config.plugins ?? [];
    const pluginIds = plugins.map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin));

    expect(pluginIds).toContain('./plugins/withAndroidPlayCompliance.js');
    expect(pluginIds).not.toContain('react-native-edge-to-edge');

    const buildProperties = plugins.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties',
    ) as [string, { android?: Record<string, unknown> }] | undefined;

    expect(buildProperties?.[1]?.android?.enableMinifyInReleaseBuilds).toBe(true);
    expect(buildProperties?.[1]?.android?.enableShrinkResourcesInReleaseBuilds).toBe(true);
    expect(buildProperties?.[1]?.android?.enablePngCrunchInReleaseBuilds).toBe(true);
    expect(config.androidNavigationBar?.enforceContrast).toBe(false);
    expect(config.android?.edgeToEdgeEnabled).toBeUndefined();
  });

  it('registers native config plugins that guard against recent regressions', () => {
    const plugins = config.plugins ?? [];
    const pluginIds = plugins.map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin));

    expect(pluginIds).toContain('./plugins/withIosUsageDescriptions.js');
    expect(pluginIds).toContain('./plugins/withHermesDsym.js');
    expect(pluginIds).toContain('./plugins/withAndroidReleaseSigning.js');
    expect(pluginIds).toContain('expo-location');
  });
});
