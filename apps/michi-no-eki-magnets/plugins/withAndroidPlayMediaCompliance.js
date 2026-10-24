const { AndroidConfig } = require('@expo/config-plugins');

const BLOCKED_MEDIA_PERMISSIONS = [
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
];

function withAndroidPlayMediaCompliance(config) {
  return AndroidConfig.Permissions.withBlockedPermissions(
    config,
    BLOCKED_MEDIA_PERMISSIONS,
  );
}

module.exports = withAndroidPlayMediaCompliance;
