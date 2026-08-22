#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = path.join(projectRoot, 'assets');
const bucket = 'station-data';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '');
const apiKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !apiKey) {
  console.error(
    'Missing EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or EXPO_PUBLIC_SUPABASE_ANON_KEY).',
  );
  process.exit(1);
}

const uploads = [
  {
    objectPath: 'data-manifest.json',
    filePath: path.join(assetsDir, 'data-manifest.json'),
    contentType: 'application/json',
  },
  {
    objectPath: 'stations.json',
    filePath: path.join(assetsDir, 'stations.json'),
    contentType: 'application/json',
  },
];

async function uploadObject({ objectPath, filePath, contentType }) {
  const body = readFileSync(filePath);
  const url = `${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      apikey: apiKey,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Upload failed for ${objectPath} (${response.status}): ${detail}`);
  }

  console.log(`Uploaded ${objectPath}`);
}

async function main() {
  for (const item of uploads) {
    await uploadObject(item);
  }

  const manifest = JSON.parse(readFileSync(path.join(assetsDir, 'data-manifest.json'), 'utf8'));
  console.log(`Done. Remote manifest version: ${manifest.version}`);
  console.log(`Public base URL: ${supabaseUrl}/storage/v1/object/public/${bucket}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
