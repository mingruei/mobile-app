const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# Xcode 26 workaround: patch fmt to disable consteval';
const DEPLOYMENT_MARKER = '# Keep pod deployment targets aligned with the app';
const OBJECT_VERSION_MARKER =
  '# Xcode 27: CocoaPods 1.16 cannot create a Pods project at objectVersion 70';

const OBJECT_VERSION_PATCH = `${OBJECT_VERSION_MARKER}
require 'xcodeproj'
xcodeproj_versions = Xcodeproj::Constants::COMPATIBILITY_VERSION_BY_OBJECT_VERSION.dup
unless xcodeproj_versions.key?(70)
  xcodeproj_versions[70] = xcodeproj_versions[77] || 'Xcode 16.0'
  Xcodeproj::Constants.send(:remove_const, :COMPATIBILITY_VERSION_BY_OBJECT_VERSION)
  Xcodeproj::Constants.const_set(:COMPATIBILITY_VERSION_BY_OBJECT_VERSION, xcodeproj_versions.freeze)
end
`;

const DEPLOYMENT_PATCH = `
    ${DEPLOYMENT_MARKER}
    deployment_target = podfile_properties['ios.deploymentTarget'] || '16.0'
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = deployment_target
      end
    end
    installer.pods_project.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = deployment_target
    end`;

const FMT_PATCH = `
    ${MARKER}
    fmt_base = File.join(installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      content = File.read(fmt_base)
      unless content.include?('Xcode 26 workaround')
        patched = content.gsub('#  define FMT_USE_CONSTEVAL 1', '#  define FMT_USE_CONSTEVAL 0')
        patched = patched.sub(
          '#elif defined(__cpp_consteval)',
          "#elif defined(__cpp_consteval)\\n// Xcode 26 workaround: disable consteval"
        )
        if patched != content
          File.chmod(0644, fmt_base)
          File.write(fmt_base, patched)
        end
      end
    end`;

function withFmtXcode26Fix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      if (
        !contents.includes(MARKER) ||
        !contents.includes(DEPLOYMENT_MARKER) ||
        !contents.includes(OBJECT_VERSION_MARKER)
      ) {
        let updated = contents;
        if (!updated.includes(OBJECT_VERSION_MARKER)) {
          updated = updated.replace(
            'prepare_react_native_project!',
            `${OBJECT_VERSION_PATCH}\nprepare_react_native_project!`,
          );
        }
        if (!updated.includes(MARKER)) {
          updated = updated.replace(
            /(post_install do \|installer\|[\s\S]*?react_native_post_install\([\s\S]*?\)\n)/,
            `$1${FMT_PATCH}\n`,
          );
        }
        if (!updated.includes(DEPLOYMENT_MARKER)) {
          updated = updated.replace(
            /(post_install do \|installer\|[\s\S]*?react_native_post_install\([\s\S]*?\)\n)/,
            `$1${DEPLOYMENT_PATCH}\n`,
          );
        }

        if (updated === contents) {
          throw new Error('Failed to insert Xcode deployment target workaround into Podfile.');
        }

        fs.writeFileSync(podfilePath, updated);
      }

      return config;
    },
  ]);
}

module.exports = withFmtXcode26Fix;
