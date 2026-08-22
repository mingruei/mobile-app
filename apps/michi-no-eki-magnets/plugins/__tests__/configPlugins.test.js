jest.mock('@expo/config-plugins', () => ({
  withInfoPlist: jest.fn((config, callback) => {
    callback({ modResults: {} });
    return config;
  }),
  withAppBuildGradle: jest.fn((config, callback) => {
    callback({
      modResults: {
        language: 'groovy',
        contents: 'android { defaultConfig { versionCode 1 } }',
      },
    });
    return config;
  }),
  withDangerousMod: jest.fn((config, pair) => {
    const [, mod] = pair;
    return mod(config);
  }),
  withXcodeProject: jest.fn((config, callback) => {
    callback({
      modResults: {
        getTarget: jest.fn(() => ({ uuid: 'target-uuid' })),
        getFirstTarget: jest.fn(() => ({ uuid: 'fallback-uuid' })),
        hash: { project: { objects: { PBXShellScriptBuildPhase: {} } } },
        addBuildPhase: jest.fn(),
      },
      modRequest: { projectRoot: '/tmp/project' },
    });
    return config;
  }),
}));

const fs = require('fs');
const os = require('os');
const path = require('path');

const { withAppBuildGradle, withInfoPlist, withXcodeProject } = require('@expo/config-plugins');
const permissionMessages = require('../permissionMessages');
const withAndroidReleaseFileName = require('../withAndroidReleaseFileName');
const withAndroidReleaseSigning = require('../withAndroidReleaseSigning');
const withFmtXcode26Fix = require('../withFmtXcode26Fix');
const withIosUsageDescriptions = require('../withIosUsageDescriptions');
const withHermesDsym = require('../withHermesDsym');

describe('permissionMessages', () => {
  it('defines non-empty permission copy for all native prompts', () => {
    expect(permissionMessages.location.length).toBeGreaterThan(0);
    expect(permissionMessages.photo.length).toBeGreaterThan(0);
    expect(permissionMessages.camera.length).toBeGreaterThan(0);
  });

  it('describes michi-no-eki magnet uploads rather than castle collectibles', () => {
    expect(permissionMessages.photo).toContain('道之駅磁鐵');
    expect(permissionMessages.camera).toContain('道之駅磁鐵');
    expect(permissionMessages.photo).not.toContain('御城印');
  });
});

describe('withIosUsageDescriptions', () => {
  it('writes required iOS permission usage descriptions', () => {
    withIosUsageDescriptions({ name: 'test', slug: 'test' });

    expect(withInfoPlist).toHaveBeenCalled();
    const callback = withInfoPlist.mock.calls[0][1];
    const result = callback({
      modResults: {
        NSMicrophoneUsageDescription: 'Allow app to access your microphone',
      },
    });

    expect(result.modResults.NSLocationWhenInUseUsageDescription).toBe(permissionMessages.location);
    expect(result.modResults.NSLocationAlwaysUsageDescription).toBe(permissionMessages.location);
    expect(result.modResults.NSLocationAlwaysAndWhenInUseUsageDescription).toBe(
      permissionMessages.location,
    );
    expect(result.modResults.NSPhotoLibraryUsageDescription).toBe(permissionMessages.photo);
    expect(result.modResults.NSCameraUsageDescription).toBe(permissionMessages.camera);
    expect(result.modResults.NSMicrophoneUsageDescription).toBeUndefined();
  });
});

describe('withHermesDsym', () => {
  it('locates the iOS application target by product type', () => {
    const fs = require('fs');
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    jest.spyOn(fs, 'copyFileSync').mockImplementation(() => undefined);
    jest.spyOn(fs, 'chmodSync').mockImplementation(() => undefined);

    withHermesDsym({ name: 'test', slug: 'test' });

    expect(withXcodeProject).toHaveBeenCalled();
    const callback = withXcodeProject.mock.calls.at(-1)[1];
    const project = {
      getTarget: jest.fn((productType) =>
        productType === 'com.apple.product-type.application'
          ? { uuid: 'target-uuid' }
          : null,
      ),
      getFirstTarget: jest.fn(() => ({ uuid: 'fallback-uuid' })),
      hash: { project: { objects: { PBXShellScriptBuildPhase: {} } } },
      addBuildPhase: jest.fn(),
    };

    callback({
      modResults: project,
      modRequest: { projectRoot: '/tmp/project' },
    });

    expect(project.getTarget).toHaveBeenCalledWith('com.apple.product-type.application');
    expect(project.addBuildPhase).toHaveBeenCalledWith(
      [],
      'PBXShellScriptBuildPhase',
      'Generate Hermes dSYM',
      'target-uuid',
      expect.objectContaining({ shellPath: '/bin/sh' }),
    );

    fs.mkdirSync.mockRestore();
    fs.copyFileSync.mockRestore();
    fs.chmodSync.mockRestore();
  });

  it('throws when no application target exists', () => {
    const fs = require('fs');
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    jest.spyOn(fs, 'copyFileSync').mockImplementation(() => undefined);
    jest.spyOn(fs, 'chmodSync').mockImplementation(() => undefined);

    withHermesDsym({ name: 'test-throw', slug: 'test-throw' });
    const callback = withXcodeProject.mock.calls.at(-1)[1];
    const project = {
      getTarget: jest.fn(() => null),
      getFirstTarget: jest.fn(() => null),
      hash: { project: { objects: { PBXShellScriptBuildPhase: {} } } },
      addBuildPhase: jest.fn(),
    };

    expect(() =>
      callback({
        modResults: project,
        modRequest: { projectRoot: '/tmp/project' },
      }),
    ).toThrow('Could not find iOS application target for Hermes dSYM script.');

    fs.mkdirSync.mockRestore();
    fs.copyFileSync.mockRestore();
    fs.chmodSync.mockRestore();
  });

  it('does not add duplicate Hermes dSYM build phases', () => {
    const fs = require('fs');
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    jest.spyOn(fs, 'copyFileSync').mockImplementation(() => undefined);
    jest.spyOn(fs, 'chmodSync').mockImplementation(() => undefined);

    withHermesDsym({ name: 'test-dedupe', slug: 'test-dedupe' });
    const callback = withXcodeProject.mock.calls.at(-1)[1];
    const addBuildPhase = jest.fn();
    const project = {
      getTarget: jest.fn(() => ({ uuid: 'target-uuid' })),
      getFirstTarget: jest.fn(),
      hash: {
        project: {
          objects: {
            PBXShellScriptBuildPhase: {
              existing: { shellScript: '"generate-hermes-dsym.sh"\n' },
            },
          },
        },
      },
      addBuildPhase,
    };

    callback({
      modResults: project,
      modRequest: { projectRoot: '/tmp/project' },
    });

    expect(addBuildPhase).not.toHaveBeenCalled();

    fs.mkdirSync.mockRestore();
    fs.copyFileSync.mockRestore();
    fs.chmodSync.mockRestore();
  });
});

describe('withAndroidReleaseFileName', () => {
  it('appends release artifact copy snippet to build.gradle', () => {
    withAndroidReleaseFileName({ name: 'test', slug: 'test' });

    expect(withAppBuildGradle).toHaveBeenCalled();
    const callback = withAppBuildGradle.mock.calls.at(-1)[1];
    const config = {
      modResults: {
        language: 'groovy',
        contents: 'android { defaultConfig { versionCode 1 } }',
      },
    };

    const result = callback(config);
    expect(result.modResults.contents).toContain('release-artifact-file-name');
    expect(result.modResults.contents).toContain('bundleRelease');
    expect(result.modResults.contents).toContain('app-release.aab');
    expect(result.modResults.contents).not.toContain('renameTo');
  });

  it('skips non-groovy gradle files and replaces prior generated snippets', () => {
    withAndroidReleaseFileName({ name: 'kotlin', slug: 'kotlin' });
    const kotlinCallback = withAppBuildGradle.mock.calls.at(-1)[1];
    const kotlinResult = kotlinCallback({
      modResults: { language: 'kotlin', contents: 'plugins {}' },
    });
    expect(kotlinResult.modResults.contents).toBe('plugins {}');

    withAndroidReleaseFileName({ name: 'replace', slug: 'replace' });
    const replaceCallback = withAppBuildGradle.mock.calls.at(-1)[1];
    const replaceResult = replaceCallback({
      modResults: {
        language: 'groovy',
        contents: `android {}\n// @generated begin release-artifact-file-name\nOLD\n// @generated end release-artifact-file-name\n`,
      },
    });
    expect(replaceResult.modResults.contents).not.toContain('OLD');
    expect(replaceResult.modResults.contents).toContain('Release bundle copy');
  });
});

describe('withAndroidReleaseSigning', () => {
  it('appends absolute-path keystore.properties signing helpers', () => {
    withAndroidReleaseSigning({ name: 'test', slug: 'test' });

    expect(withAppBuildGradle).toHaveBeenCalled();
    const callback = withAppBuildGradle.mock.calls.at(-1)[1];
    const result = callback({
      modResults: {
        language: 'groovy',
        contents: `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.debug
        }
    }
}`,
      },
    });

    expect(result.modResults.contents).toContain(
      'android-release-signing-from-keystore-properties',
    );
    expect(result.modResults.contents).toContain('japanCastlesResolveReleaseKeystoreFile');
    expect(result.modResults.contents).toContain('do not use ~');
    expect(result.modResults.contents).not.toContain('afterEvaluate');
    expect(result.modResults.contents).toContain(
      'signingConfig = signingConfigs.findByName("release") ?: signingConfigs.debug',
    );
  });

  it('rewrites release signing when Expo uses assignment syntax', () => {
    withAndroidReleaseSigning({ name: 'test', slug: 'test' });

    const callback = withAppBuildGradle.mock.calls.at(-1)[1];
    const result = callback({
      modResults: {
        language: 'groovy',
        contents: `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        release {
            signingConfig = signingConfigs.debug
        }
    }
}`,
      },
    });

    expect(result.modResults.contents).toContain(
      'signingConfig = signingConfigs.findByName("release") ?: signingConfigs.debug',
    );
  });

  it('skips non-groovy gradle files and does not duplicate snippets', () => {
    withAndroidReleaseSigning({ name: 'kotlin', slug: 'kotlin' });
    const kotlinCallback = withAppBuildGradle.mock.calls.at(-1)[1];
    const kotlinResult = kotlinCallback({
      modResults: { language: 'kotlin', contents: 'plugins {}' },
    });
    expect(kotlinResult.modResults.contents).toBe('plugins {}');

    withAndroidReleaseSigning({ name: 'dedupe', slug: 'dedupe' });
    const dedupeCallback = withAppBuildGradle.mock.calls.at(-1)[1];
    const marked = '// @generated begin android-release-signing-from-keystore-properties\nKEEP\n// @generated end android-release-signing-from-keystore-properties\n';
    const dedupeResult = dedupeCallback({
      modResults: {
        language: 'groovy',
        contents: `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.debug
        }
    }
}
${marked}`,
      },
    });
    expect(dedupeResult.modResults.contents).toContain('japanCastlesResolveReleaseKeystoreFile');
    expect(dedupeResult.modResults.contents).toContain(
      '// @generated begin android-release-signing-from-keystore-properties',
    );
  });
});

describe('withFmtXcode26Fix', () => {
  it('inserts fmt workaround into Podfile post_install', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fmt-fix-'));
    const podfilePath = path.join(tempDir, 'Podfile');
    fs.writeFileSync(
      podfilePath,
      [
        "post_install do |installer|",
        "  react_native_post_install(installer)",
        "end",
      ].join('\n'),
    );

    withFmtXcode26Fix({
      name: 'test',
      slug: 'test',
      modRequest: { platformProjectRoot: tempDir },
    });

    const updated = fs.readFileSync(podfilePath, 'utf8');
    expect(updated).toContain('Xcode 26 workaround');
    expect(updated).toContain('FMT_USE_CONSTEVAL 0');
  });
});
