#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const aabPath = resolve(process.argv[2] ?? '');

const FORBIDDEN_PERMISSIONS = [
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
];

if (!aabPath) {
  console.error('Usage: node scripts/verify-aab-permissions.mjs <path/to/app.aab>');
  process.exit(1);
}

if (!existsSync(aabPath)) {
  console.error(`AAB not found: ${aabPath}`);
  process.exit(1);
}

function findAapt2() {
  const sdkRoot = process.env.ANDROID_HOME ?? join(homedir(), 'Library/Android/sdk');
  const buildToolsDir = join(sdkRoot, 'build-tools');
  if (!existsSync(buildToolsDir)) {
    return null;
  }

  const versions = execFileSync('ls', [buildToolsDir], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

  for (const version of versions) {
    const candidate = join(buildToolsDir, version, 'aapt2');
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function readManifestFromAab(aabFilePath) {
  const aapt2 = findAapt2();
  if (!aapt2) {
    return null;
  }

  try {
    return execFileSync(
      aapt2,
      ['dump', 'xmltree', '--file', 'AndroidManifest.xml', aabFilePath],
      { encoding: 'utf8' },
    );
  } catch {
    return null;
  }
}

function readManifestFromGradleOutput(aabFilePath) {
  const manifestPath = resolve(
    aabFilePath,
    '../../../../intermediates/bundle_manifest/release/processApplicationManifestReleaseForBundle/AndroidManifest.xml',
  );

  if (!existsSync(manifestPath)) {
    return null;
  }

  return readFileSync(manifestPath, 'utf8');
}

const manifestText = readManifestFromGradleOutput(aabPath) ?? readManifestFromAab(aabPath);

if (!manifestText) {
  console.error('Could not read merged manifest from AAB.');
  console.error('Install Android build-tools or build locally before verifying.');
  process.exit(1);
}

const found = FORBIDDEN_PERMISSIONS.filter((permission) => {
  const shortName = permission.replace('android.permission.', '');
  return manifestText.includes(permission) || manifestText.includes(shortName);
});

if (found.length > 0) {
  console.error('Forbidden media/storage permissions found in release manifest:');
  for (const permission of found) {
    console.error(`  - ${permission}`);
  }
  process.exit(1);
}

console.log(`OK: ${aabPath} does not declare broad media/storage permissions.`);
