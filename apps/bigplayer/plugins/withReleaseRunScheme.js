const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withReleaseRunScheme(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectName = String(config.name ?? 'BigPlayer').replace(/[^A-Za-z0-9]/g, '') || 'BigPlayer';
      const schemePath = path.join(
        config.modRequest.platformProjectRoot,
        `${projectName}.xcodeproj`,
        'xcshareddata',
        'xcschemes',
        `${projectName}.xcscheme`,
      );

      if (!fs.existsSync(schemePath)) {
        throw new Error(`Missing Xcode scheme: ${schemePath}`);
      }

      let xml = fs.readFileSync(schemePath, 'utf8');
      xml = xml.replace(
        /(<LaunchAction[\s\S]*?buildConfiguration = ")Debug(")/,
        '$1Release$2',
      );
      fs.writeFileSync(schemePath, xml);
      return config;
    },
  ]);
}

module.exports = withReleaseRunScheme;
