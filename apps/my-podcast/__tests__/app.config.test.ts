import config from '../app.config';

describe('app.config', () => {
  it('plays audio in the background on iPhone', () => {
    expect(config.name).toBe('AudioFlow');
    expect(config.ios?.infoPlist?.CFBundleDisplayName).toBe('奧笛流');
    expect(config.slug).toBe('my-podcast');
    expect(config.orientation).toBe('portrait');
    expect(config.ios?.supportsTablet).toBe(false);
    expect(config.ios?.bundleIdentifier).toBe('com.invisibleworksop.mypodcast');
    expect(config.ios?.infoPlist?.UIBackgroundModes).toEqual(['audio']);
    expect(config.ios?.infoPlist?.UIApplicationSceneManifest?.UISceneConfigurations).toBeDefined();
    expect(config.plugins).toContain('./plugins/withIosSceneLifecycle.js');
    expect(config.plugins).toContain('@bacons/apple-targets');
    expect(config.android).toBeUndefined();

    const plugins = config.plugins ?? [];
    const buildProperties = plugins.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties',
    ) as [string, { ios?: { deploymentTarget?: string } }] | undefined;
    expect(buildProperties?.[1]?.ios?.deploymentTarget).toBe('16.0');
  });
});
