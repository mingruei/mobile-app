/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'watch-widget',
  name: 'Complication',
  displayName: '奧笛流',
  deploymentTarget: '11.0',
  bundleIdentifier: '.watchkitapp.face',
  colors: {
    $accent: '#C2410C',
    $widgetBackground: '#F3EFE6',
  },
};
