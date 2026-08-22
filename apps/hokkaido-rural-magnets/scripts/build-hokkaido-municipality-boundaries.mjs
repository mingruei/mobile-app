#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(projectRoot, 'data-source', 'hokkaido_map_web_4612.geojson');
const stationsPath = path.join(projectRoot, 'assets', 'hokkaido-countries.json');
const outputPath = path.join(projectRoot, 'assets', 'hokkaido-municipality-boundaries.json');
const reportPath = path.join(projectRoot, 'data-source', 'hokkaido-boundary-import-report.json');

/** Northern territories polygons present in source data but not in the app municipality list. */
const EXCLUDED_CITY_NAMES = new Set(['歯舞群島', '色丹島', '国後島', '択捉島']);

function main() {
  const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
  const stations = JSON.parse(readFileSync(stationsPath, 'utf8'));

  if (!Array.isArray(source.features) || !Array.isArray(stations)) {
    throw new Error('Expected FeatureCollection source and station array.');
  }

  const stationByCity = new Map(stations.map((station) => [station.city, station]));
  const features = [];

  for (const feature of source.features) {
    const city = feature.properties?.['市町村名'];
    if (!city || EXCLUDED_CITY_NAMES.has(city)) {
      continue;
    }

    const station = stationByCity.get(city);
    if (!station) {
      throw new Error(`No station record for boundary polygon: ${city}`);
    }

    features.push({
      type: 'Feature',
      properties: {
        id: station.id,
        number: station.number,
        name: station.name,
        city: station.city,
      },
      geometry: feature.geometry,
    });
  }

  if (features.length !== stations.length) {
    const matchedCities = new Set(features.map((feature) => feature.properties.city));
    const missing = stations.filter((station) => !matchedCities.has(station.city)).map((station) => station.city);
    throw new Error(
      `Expected ${stations.length} municipality boundaries, got ${features.length}. Missing: ${missing.join(', ')}`,
    );
  }

  const collection = {
    type: 'FeatureCollection',
    features,
  };

  writeFileSync(outputPath, `${JSON.stringify(collection)}\n`);

  const report = {
    generatedAt: new Date().toISOString(),
    source: sourcePath,
    stationsSource: stationsPath,
    featureCount: features.length,
    excludedCityNames: [...EXCLUDED_CITY_NAMES],
    sapporoMode: 'city',
    note: 'Source GeoJSON already uses 札幌市 as a single municipality polygon.',
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Wrote ${outputPath} (${features.length} municipality boundaries)`);
  console.log(`Wrote ${reportPath}`);
}

main();
