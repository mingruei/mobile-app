/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'watch',
  name: 'Watch',
  displayName: '奧笛流',
  icon: '../../assets/icon.png',
  deploymentTarget: '11.0',
  bundleIdentifier: '.watchkitapp',
  frameworks: ['WatchConnectivity', 'AVFoundation', 'MediaPlayer', 'WatchKit'],
};
