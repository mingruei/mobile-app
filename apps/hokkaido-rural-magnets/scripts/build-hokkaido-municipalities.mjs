#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildDescriptionZhLookup } from './lib/municipality-description-zh.mjs';
import { buildEnglishNameLookup } from './lib/municipality-english-names.mjs';
import { buildNameZhRecords, toMunicipalityNameZh } from './lib/municipality-name-zh.mjs';
import { normalizeZhTwText } from './lib/zh-tw-normalize.mjs';
import { HOKKAIDO_MUNICIPALITY_AREAS } from './lib/hokkaido-municipality-areas.mjs';

const LOCALGOVJP_URL = 'https://code4fukui.github.io/localgovjp/localgovjp.json';
const MUNICIPALITIES_URL =
  'https://raw.githubusercontent.com/piuccio/open-data-jp-municipalities/master/municipalities.json';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsPath = path.join(projectRoot, 'assets', 'hokkaido-countries.json');
const dataSourceDir = path.join(projectRoot, 'data-source');
const cachedSourcePath = path.join(dataSourceDir, 'localgovjp-hokkaido.json');
const cachedEnglishNamesPath = path.join(dataSourceDir, 'open-data-jp-municipalities.json');
const descriptionsZhPath = path.join(dataSourceDir, 'hokkaido-municipality-descriptions-zh.json');
const namesZhPath = path.join(dataSourceDir, 'hokkaido-municipality-names-zh.json');
const reportPath = path.join(dataSourceDir, 'hokkaido-municipality-import-report.json');

const offline = process.argv.includes('--offline');

function sortKey(city) {
  const match = city.match(/^(.+?[市区町村])(.*)$/u);
  return match ? [match[1], match[2] ?? ''] : [city, ''];
}

function compareMunicipalities(a, b) {
  const [aType, aRest] = sortKey(a.city);
  const [bType, bRest] = sortKey(b.city);
  const typeOrder = { 市: 0, 町: 1, 村: 2 };
  const aOrder = typeOrder[aType.slice(-1)] ?? 9;
  const bOrder = typeOrder[bType.slice(-1)] ?? 9;
  if (aOrder !== bOrder) {
    return aOrder - bOrder;
  }

  return a.city.localeCompare(b.city, 'ja');
}

async function loadLocalGovRecords() {
  mkdirSync(dataSourceDir, { recursive: true });

  if (!offline) {
    const response = await fetch(LOCALGOVJP_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${LOCALGOVJP_URL}: HTTP ${response.status}`);
    }

    const records = await response.json();
    writeFileSync(cachedSourcePath, `${JSON.stringify(records, null, 2)}\n`);
    return { source: LOCALGOVJP_URL, records };
  }

  const { readFileSync } = await import('node:fs');
  const records = JSON.parse(readFileSync(cachedSourcePath, 'utf8'));
  return { source: cachedSourcePath, records };
}

async function loadEnglishNameLookup() {
  mkdirSync(dataSourceDir, { recursive: true });

  if (!offline) {
    const response = await fetch(MUNICIPALITIES_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${MUNICIPALITIES_URL}: HTTP ${response.status}`);
    }

    const records = await response.json();
    writeFileSync(cachedEnglishNamesPath, `${JSON.stringify(records, null, 2)}\n`);
    return { source: MUNICIPALITIES_URL, lookup: buildEnglishNameLookup(records) };
  }

  const { readFileSync } = await import('node:fs');
  const records = JSON.parse(readFileSync(cachedEnglishNamesPath, 'utf8'));
  return { source: cachedEnglishNamesPath, lookup: buildEnglishNameLookup(records) };
}

function loadDescriptionZhLookup() {
  const records = JSON.parse(readFileSync(descriptionsZhPath, 'utf8'));
  const lookup = buildDescriptionZhLookup(records);

  if (lookup.size !== 179) {
    throw new Error(`Expected 179 Chinese descriptions, got ${lookup.size}`);
  }

  return lookup;
}

function toStation(record, number, englishNameLookup, descriptionZhLookup) {
  const city = record.city;
  const area = HOKKAIDO_MUNICIPALITY_AREAS[city];
  if (!area) {
    throw new Error(`Missing Hokkaido area mapping for municipality: ${city}`);
  }

  const latitude = Number.parseFloat(record.lat);
  const longitude = Number.parseFloat(record.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error(`Invalid coordinates for municipality: ${city}`);
  }

  const lgcode = record.lgcode?.trim();
  const nameEn = lgcode ? englishNameLookup.get(lgcode) ?? null : null;
  if (!nameEn) {
    throw new Error(`Missing English name for municipality: ${city} (${lgcode})`);
  }

  const stationId = Number.parseInt(record.lgcode, 10);
  const shortDescription = record.phrase?.trim() || null;
  const shortDescriptionZhRaw = descriptionZhLookup.get(stationId) ?? null;
  const shortDescriptionZh = shortDescriptionZhRaw
    ? normalizeZhTwText(shortDescriptionZhRaw)
    : null;
  if (shortDescription && !shortDescriptionZh) {
    throw new Error(`Missing Chinese description for municipality: ${city} (${record.lgcode})`);
  }

  const nameZh = toMunicipalityNameZh(city);

  return {
    id: stationId,
    number,
    name: city,
    nameZh,
    nameEn,
    prefecture: '北海道',
    city,
    location: `北海道${city}`,
    latitude,
    longitude,
    shortDescription,
    shortDescriptionZh,
    website: record.url?.trim() || null,
    access: null,
    services: [],
  };
}

async function main() {
  const descriptionZhLookup = loadDescriptionZhLookup();
  const [{ source, records }, { source: englishSource, lookup: englishNameLookup }] =
    await Promise.all([loadLocalGovRecords(), loadEnglishNameLookup()]);

  const municipalities = records
    .filter((record) => record.pref === '北海道' && !record.city.endsWith('区'))
    .sort(compareMunicipalities);

  if (municipalities.length !== 179) {
    throw new Error(`Expected 179 Hokkaido municipalities, got ${municipalities.length}`);
  }

  const mappedNames = new Set(Object.keys(HOKKAIDO_MUNICIPALITY_AREAS));
  const municipalityNames = new Set(municipalities.map((record) => record.city));
  const missingMappings = [...municipalityNames].filter((name) => !mappedNames.has(name));
  const extraMappings = [...mappedNames].filter((name) => !municipalityNames.has(name));

  if (missingMappings.length > 0 || extraMappings.length > 0) {
    throw new Error(
      [
        'Municipality area mapping mismatch.',
        missingMappings.length > 0 ? `Missing: ${missingMappings.join(', ')}` : null,
        extraMappings.length > 0 ? `Extra: ${extraMappings.join(', ')}` : null,
      ]
        .filter(Boolean)
        .join(' '),
    );
  }

  const nameZhRecords = buildNameZhRecords(municipalities);
  writeFileSync(namesZhPath, `${JSON.stringify(nameZhRecords, null, 2)}\n`);

  const stations = municipalities.map((record, index) =>
    toStation(record, index + 1, englishNameLookup, descriptionZhLookup),
  );

  writeFileSync(assetsPath, `${JSON.stringify(stations, null, 2)}\n`);

  const report = {
    generatedAt: new Date().toISOString(),
    source,
    englishNameSource: englishSource,
    descriptionZhSource: descriptionsZhPath,
    nameZhSource: namesZhPath,
    municipalityCount: stations.length,
    areaCounts: stations.reduce((counts, station) => {
      const area = HOKKAIDO_MUNICIPALITY_AREAS[station.city];
      counts[area] = (counts[area] ?? 0) + 1;
      return counts;
    }, {}),
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Wrote ${assetsPath} (${stations.length} municipalities)`);
  console.log(`Wrote ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
