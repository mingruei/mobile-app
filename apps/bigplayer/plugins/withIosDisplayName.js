const { withInfoPlist } = require('@expo/config-plugins');

function withIosDisplayName(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.CFBundleDisplayName = '大字播';
    config.modResults.CFBundleName = '大字播';
    return config;
  });
}

module.exports = withIosDisplayName;
