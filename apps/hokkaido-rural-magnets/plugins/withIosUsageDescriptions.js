const { withInfoPlist } = require('@expo/config-plugins');
const messages = require('./permissionMessages');

function withIosUsageDescriptions(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.NSLocationWhenInUseUsageDescription = messages.location;
    config.modResults.NSLocationAlwaysUsageDescription = messages.location;
    config.modResults.NSLocationAlwaysAndWhenInUseUsageDescription = messages.location;
    config.modResults.NSPhotoLibraryUsageDescription = messages.photo;
    config.modResults.NSCameraUsageDescription = messages.camera;
    // App does not use the microphone; remove any placeholder string that
    // dependencies (e.g. expo-image-picker defaults) may have injected.
    delete config.modResults.NSMicrophoneUsageDescription;
    return config;
  });
}

module.exports = withIosUsageDescriptions;
