const { withAppBuildGradle } = require('@expo/config-plugins');

const MARKER = 'release-artifact-file-name';

/**
 * Copy (do not rename/delete) the AGP output artifact to a friendlier name.
 * Always copy from app-release.* so stale michi-no-eki-magnets-* artifacts cannot
 * be picked up when versionCode changes.
 */
const RELEASE_FILE_NAME_SNIPPET = `
// @generated begin ${MARKER}
afterEvaluate {
    tasks.matching { it.name == "bundleRelease" }.configureEach { task ->
        task.doLast {
            def artifactBaseName =
                "michi-no-eki-magnets-\${android.defaultConfig.versionName}-\${android.defaultConfig.versionCode}"
            def outputDir = file("\${layout.buildDirectory.get()}/outputs/bundle/release")
            def bundleFile = new File(outputDir, "app-release.aab")
            if (!bundleFile.isFile()) {
                logger.lifecycle("Release bundle copy skipped: app-release.aab not found")
                return
            }

            def targetFile = new File(outputDir, "\${artifactBaseName}.aab")
            if (targetFile.exists()) {
                targetFile.delete()
            }
            bundleFile.withInputStream { input ->
                targetFile.withOutputStream { output -> output << input }
            }
            logger.lifecycle("Release bundle copy: \${targetFile.name} (from \${bundleFile.name})")
        }
    }

    tasks.matching { it.name == "assembleRelease" }.configureEach { task ->
        task.doLast {
            def artifactBaseName =
                "michi-no-eki-magnets-\${android.defaultConfig.versionName}-\${android.defaultConfig.versionCode}"
            def outputDir = file("\${layout.buildDirectory.get()}/outputs/apk/release")
            def apkFile = new File(outputDir, "app-release.apk")
            if (!apkFile.isFile()) {
                return
            }

            def targetFile = new File(outputDir, "\${artifactBaseName}.apk")
            if (targetFile.exists() && targetFile.absolutePath != apkFile.absolutePath) {
                targetFile.delete()
            }
            if (apkFile.absolutePath != targetFile.absolutePath) {
                apkFile.withInputStream { input ->
                    targetFile.withOutputStream { output -> output << input }
                }
                logger.lifecycle("Release apk copy: \${targetFile.name} (from \${apkFile.name})")
            }
        }
    }
}
// @generated end ${MARKER}
`;

function stripGeneratedBlock(contents) {
  return contents.replace(
    /\n?\/\/ @generated begin release-artifact-file-name[\s\S]*?\/\/ @generated end release-artifact-file-name\n?/g,
    '\n',
  );
}

function withAndroidReleaseFileName(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      return config;
    }

    let contents = stripGeneratedBlock(config.modResults.contents);
    contents += `\n${RELEASE_FILE_NAME_SNIPPET}\n`;
    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withAndroidReleaseFileName;
