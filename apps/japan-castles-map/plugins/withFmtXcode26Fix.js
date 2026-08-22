const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# Xcode 26 workaround: patch fmt to disable consteval';

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

      if (!contents.includes(MARKER)) {
        const updated = contents.replace(
          /(post_install do \|installer\|[\s\S]*?react_native_post_install\([\s\S]*?\)\n)/,
          `$1${FMT_PATCH}\n`,
        );

        if (updated === contents) {
          throw new Error('Failed to insert fmt Xcode 26 workaround into Podfile.');
        }

        fs.writeFileSync(podfilePath, updated);
      }

      return config;
    },
  ]);
}

module.exports = withFmtXcode26Fix;
