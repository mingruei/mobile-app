const { AndroidConfig, withAndroidManifest, withAndroidStyles, withAppBuildGradle } =
  require('@expo/config-plugins');

const ML_KIT_PORTRAIT_ACTIVITIES = [
  'com.google.mlkit.vision.documentscanner.internal.GmsDocumentScanningDelegateActivity',
  'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity',
];

const DEPRECATED_SYSTEM_BAR_STYLE_ITEMS = new Set([
  'android:statusBarColor',
  'android:navigationBarColor',
  'android:navigationBarDividerColor',
]);

const R8_MARKER = 'android-r8-optimize-proguard';

/**
 * Play Console: strip deprecated system bar color theme attrs (API 35+).
 * RN 0.81 enables edge-to-edge via gradle `edgeToEdgeEnabled=true`.
 */
function withAndroidDeprecatedBarStyleRemoval(config) {
  return withAndroidStyles(config, (config) => {
    const appTheme = AndroidConfig.Styles.getAppThemeGroup();

    config.modResults = [...DEPRECATED_SYSTEM_BAR_STYLE_ITEMS].reduce(
      (xml, itemName) =>
        AndroidConfig.Styles.removeStylesItem({
          xml,
          parent: appTheme,
          name: itemName,
        }),
      config.modResults,
    );

    return config;
  });
}

/**
 * Play Console: use R8 full optimization profile (proguard-android-optimize.txt).
 */
function withAndroidR8Optimize(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      return config;
    }

    let contents = config.modResults.contents.replace(
      /\n?\/\/ @generated begin ${R8_MARKER}[\s\S]*?\/\/ @generated end ${R8_MARKER}\n?/g,
      '\n',
    );

    if (!contents.includes('proguard-android-optimize.txt')) {
      contents = contents.replace(
        /getDefaultProguardFile\("proguard-android\.txt"\)/g,
        'getDefaultProguardFile("proguard-android-optimize.txt")',
      );
    }

    config.modResults.contents = contents;
    return config;
  });
}

/**
 * Extend large-screen compliance: merge-remove portrait locks from ML Kit scanner deps.
 */
function withAndroidMlKitOrientationMerge(config) {
  return withAndroidManifest(config, (config) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    application.$['android:resizeableActivity'] = 'true';

    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);
    delete mainActivity.$['android:screenOrientation'];
    mainActivity.$['android:resizeableActivity'] = 'true';

    const activities = application.activity ?? [];
    const activityList = Array.isArray(activities) ? activities : [activities];

    for (const activityName of ML_KIT_PORTRAIT_ACTIVITIES) {
      const existing = activityList.find(
        (activity) => activity.$?.['android:name'] === activityName,
      );

      if (existing) {
        delete existing.$['android:screenOrientation'];
        existing.$['tools:node'] = 'merge';
        existing.$['tools:remove'] = 'android:screenOrientation';
        continue;
      }

      activityList.push({
        $: {
          'android:name': activityName,
          'tools:node': 'merge',
          'tools:remove': 'android:screenOrientation',
        },
      });
    }

    application.activity = activityList;
    return config;
  });
}

function withAndroidPlayCompliance(config) {
  config = withAndroidDeprecatedBarStyleRemoval(config);
  config = withAndroidR8Optimize(config);
  config = withAndroidMlKitOrientationMerge(config);
  return config;
}

module.exports = withAndroidPlayCompliance;
