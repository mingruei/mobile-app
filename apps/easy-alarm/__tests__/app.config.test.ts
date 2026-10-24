import config from '../app.config';

describe('app.config', () => {
  it('targets iPhone-only iOS 16 for a Traditional Chinese alarm app', () => {
    expect(config.name).toBe('簡易鬧鐘');
    expect(config.slug).toBe('easy-alarm');
    expect(config.orientation).toBe('portrait');
    expect(config.ios?.supportsTablet).toBe(false);
    expect(config.ios?.bundleIdentifier).toBe('com.invisibleworksop.easyalarm');
    expect(config.ios?.infoPlist?.UIBackgroundModes).toEqual(['audio']);
    expect(config.android).toBeUndefined();

    const plugins = config.plugins ?? [];
    const buildProperties = plugins.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties',
    ) as [string, { ios?: { deploymentTarget?: string } }] | undefined;
    expect(buildProperties?.[1]?.ios?.deploymentTarget).toBe('16.0');

    const notifications = plugins.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-notifications',
    ) as [string, { sounds?: string[]; mode?: string }] | undefined;
    expect(notifications?.[1]?.sounds).toEqual(['./assets/alarm.wav']);
    expect(notifications?.[1]?.mode).toBe('development');
  });
});
