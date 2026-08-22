import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = path.join(projectRoot, 'assets');
const castlesPath = path.join(assetsDir, 'castles.json');
const contentPath = path.join(assetsDir, 'i18n', 'castle-content.zh-Hant.json');
const manifestPath = path.join(assetsDir, 'data-manifest.json');

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

const castlesSize = readFileSync(castlesPath).byteLength;
const contentSize = readFileSync(contentPath).byteLength;
const previousManifest = readJson(manifestPath);
const previousVersion = typeof previousManifest.version === 'number' ? previousManifest.version : 0;

const manifest = {
  version: previousVersion,
  updatedAt: new Date().toISOString(),
  files: {
    castles: {
      path: 'castles.json',
      size: castlesSize,
      sha256: sha256File(castlesPath),
    },
    content: {
      path: 'castle-content.zh-Hant.json',
      locale: 'zh-Hant',
      size: contentSize,
      sha256: sha256File(contentPath),
    },
  },
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${manifestPath}`);
