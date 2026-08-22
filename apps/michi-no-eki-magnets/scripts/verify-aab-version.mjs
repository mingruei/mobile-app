#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const aabPath = resolve(process.argv[2] ?? '');
const expectedVersionCode = process.argv[3];

if (!aabPath || !expectedVersionCode) {
  console.error('Usage: node scripts/verify-aab-version.mjs <path/to/app.aab> <expectedVersionCode>');
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

function readVersionCodeFromMergedManifest(aabFilePath) {
  const manifestPath = resolve(
    dirname(aabFilePath),
    '../../../intermediates/bundle_manifest/release/processApplicationManifestReleaseForBundle/AndroidManifest.xml',
  );

  if (!existsSync(manifestPath)) {
    return null;
  }

  const manifest = readFileSync(manifestPath, 'utf8');
  const match = manifest.match(/android:versionCode="(\d+)"/);
  return match?.[1] ?? null;
}

function readVersionCodeFromAab(aabFilePath) {
  const aapt2 = findAapt2();
  if (!aapt2) {
    return null;
  }

  const tempDir = mkdtempSync(join(tmpdir(), 'verify-aab-'));
  try {
    execFileSync('unzip', ['-q', aabFilePath, '-d', tempDir]);
    const manifestPath = join(tempDir, 'base/manifest/AndroidManifest.xml');
    if (!existsSync(manifestPath)) {
      return null;
    }

    const dump = execFileSync(aapt2, ['dump', 'xmltree', '--file', manifestPath], {
      encoding: 'utf8',
    });
    const match = dump.match(/android:versionCode\(0x[0-9a-f]+\)=\(type 0x10\)0x([0-9a-f]+)/i)
      ?? dump.match(/versionCode[^\n]*?(\d{1,10})/i);
    if (!match?.[1]) {
      return null;
    }

    return Number.parseInt(match[1], match[1].length > 2 ? 16 : 10).toString();
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

const versionCode =
  readVersionCodeFromMergedManifest(aabPath)
  ?? readVersionCodeFromAab(aabPath);

if (!versionCode) {
  console.error('Could not read versionCode from AAB.');
  console.error('Build locally first, then verify the generated michi-no-eki-magnets-*.aab file.');
  process.exit(1);
}

if (versionCode !== expectedVersionCode) {
  console.error(`versionCode mismatch: expected ${expectedVersionCode}, got ${versionCode}`);
  process.exit(1);
}

console.log(`OK: ${aabPath} has versionCode ${versionCode}`);
