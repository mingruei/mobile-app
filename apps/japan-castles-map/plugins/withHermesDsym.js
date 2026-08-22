const { withXcodeProject } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PHASE_NAME = 'Generate Hermes dSYM';
const PHASE_MARKER = 'generate-hermes-dsym.sh';

function withHermesDsym(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const projectRoot = config.modRequest.projectRoot;
    const scriptSource = path.join(projectRoot, 'scripts', 'generate-hermes-dsym.sh');
    const scriptTarget = path.join(projectRoot, 'ios', 'scripts', 'generate-hermes-dsym.sh');

    fs.mkdirSync(path.dirname(scriptTarget), { recursive: true });
    fs.copyFileSync(scriptSource, scriptTarget);
    fs.chmodSync(scriptTarget, 0o755);

    const nativeTarget =
      project.getTarget('com.apple.product-type.application') ?? project.getFirstTarget();
    if (!nativeTarget?.uuid) {
      throw new Error('Could not find iOS application target for Hermes dSYM script.');
    }

    const buildPhases = project.hash.project.objects.PBXShellScriptBuildPhase ?? {};
    const alreadyAdded = Object.values(buildPhases).some(
      (phase) =>
        phase &&
        typeof phase === 'object' &&
        typeof phase.shellScript === 'string' &&
        phase.shellScript.includes(PHASE_MARKER),
    );

    if (!alreadyAdded) {
      project.addBuildPhase(
        [],
        'PBXShellScriptBuildPhase',
        PHASE_NAME,
        nativeTarget.uuid,
        {
          shellPath: '/bin/sh',
          shellScript: `"${scriptTarget}"\n`,
        },
      );
    }

    return config;
  });
}

module.exports = withHermesDsym;
