const { withXcodeProject } = require('@expo/config-plugins');

function withIosVersion(config) {
  const version = config.version ?? '1.0.0';
  const buildNumber = String(config.ios?.buildNumber ?? '1');

  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    project.updateBuildProperty('MARKETING_VERSION', version);
    project.updateBuildProperty('CURRENT_PROJECT_VERSION', buildNumber);
    return config;
  });
}

module.exports = withIosVersion;
