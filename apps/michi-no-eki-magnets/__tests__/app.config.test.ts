import config from '../app.config';

describe('app.config', () => {
  it('defines user-facing and Android version metadata', () => {
    expect(config.version).toBe('1.1.0');
    expect(config.ios?.buildNumber).toBe('16');
    expect(config.android?.versionCode).toBe(15);
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

  it('declares UIKit scene lifecycle for Xcode 27 / iOS 27 simulators', () => {
    const sceneManifest = config.ios?.infoPlist?.UIApplicationSceneManifest as
      | Record<string, unknown>
      | undefined;
    expect(sceneManifest?.UISceneConfigurations).toBeDefined();
  });

  it('includes required iOS permission usage descriptions', () => {
    const infoPlist = config.ios?.infoPlist ?? {};
    expect(infoPlist.NSLocationWhenInUseUsageDescription).toBeTruthy();
    expect(infoPlist.NSCameraUsageDescription).toBeTruthy();
    expect(infoPlist.NSPhotoLibraryUsageDescription).toBeTruthy();
    expect(infoPlist.NSMicrophoneUsageDescription).toBeUndefined();
  });

  it('disables expo-image-picker microphone permission', () => {
    const plugins = config.plugins ?? [];
    const imagePicker = plugins.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-image-picker',
    ) as [string, Record<string, unknown>] | undefined;

    expect(imagePicker?.[1]?.microphonePermission).toBe(false);
  });

  it('uses michi-no-eki app identity', () => {
    expect(config.name).toBe('日本道之駅磁鐵收集帳');
    expect(config.slug).toBe('michi-no-eki-magnets');
    expect(config.ios?.bundleIdentifier).toBe('com.michinoeki.magnets');
    expect(config.android?.package).toBe('com.michinoeki.magnets');
  });

  it('registers native config plugins that guard against recent regressions', () => {
    const plugins = config.plugins ?? [];
    const pluginIds = plugins.map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin));

    expect(pluginIds).toContain('./plugins/withIosSceneLifecycle.js');
    expect(pluginIds).toContain('./plugins/withIosUsageDescriptions.js');
    expect(pluginIds).toContain('./plugins/withHermesDsym.js');
    expect(pluginIds).toContain('./plugins/withAndroidReleaseSigning.js');
    expect(pluginIds).toContain('./plugins/withAndroidPlayMediaCompliance.js');
    expect(pluginIds).toContain('expo-location');
  });
});
