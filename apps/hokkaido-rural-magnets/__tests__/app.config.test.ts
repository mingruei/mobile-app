import config from '../app.config';

describe('app.config', () => {
  it('defines user-facing and Android version metadata', () => {
    expect(config.version).toBe('1.0.0');
    expect(config.ios?.buildNumber).toBe('4');
    expect(config.android?.versionCode).toBe(4);
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

  it('uses hokkaido rural magnets app identity', () => {
    expect(config.name).toBe('北海道鄉村標誌磁鐵收集帳');
    expect(config.slug).toBe('hokkaido-rural-magnets');
    expect(config.ios?.bundleIdentifier).toBe('com.hokkaidorural.magnets');
    expect(config.android?.package).toBe('com.hokkaidorural.magnets');
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
