import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = path.join(projectRoot, 'assets');
const stationsPath = path.join(assetsDir, 'stations.json');
const manifestPath = path.join(assetsDir, 'data-manifest.json');

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

const stationsSize = readFileSync(stationsPath).byteLength;
const stationsHash = sha256File(stationsPath);
const previousManifest = readJson(manifestPath);
const previousVersion = typeof previousManifest.version === 'number' ? previousManifest.version : 0;
const previousHash = previousManifest.files?.stations?.sha256 ?? null;
const version = previousHash === stationsHash ? previousVersion : previousVersion + 1;

const manifest = {
  version,
  updatedAt: new Date().toISOString(),
  files: {
    stations: {
      path: 'stations.json',
      size: stationsSize,
      sha256: stationsHash,
    },
  },
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${manifestPath} (version ${version})`);
