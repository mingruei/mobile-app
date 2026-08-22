const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// npm workspaces hoist dependencies to the monorepo root
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

const fflateBrowserPath = path.join(
  path.dirname(require.resolve('fflate/package.json')),
  'lib/browser.cjs',
);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'fflate') {
    return {
      filePath: fflateBrowserPath,
      type: 'sourceFile',
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
