import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  LINKDATA_CSV_URL,
  LINKDATA_RDF_JSON_URL,
  parseLinkDataCsv,
  transformLinkDataRdf,
} from './lib/linkdata-station-transform.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsPath = path.join(projectRoot, 'assets', 'stations.json');
const dataSourceDir = path.join(projectRoot, 'data-source');
const cachedCsvPath = path.join(dataSourceDir, 'linkdata-roadside-station.csv');
const cachedJsonPath = path.join(dataSourceDir, 'linkdata-roadside-station.rdf.json');
const reportPath = path.join(dataSourceDir, 'linkdata-import-report.json');

const args = new Set(process.argv.slice(2));
const offline = args.has('--offline');
const useCsv = args.has('--csv') || offline;

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/plain, application/json, */*',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }

  return response.text();
}

async function loadSourceRecords() {
  mkdirSync(dataSourceDir, { recursive: true });

  if (offline) {
    if (useCsv) {
      return {
        format: 'csv',
        source: cachedCsvPath,
        records: parseLinkDataCsv(readFileSync(cachedCsvPath, 'utf8')),
      };
    }

    return {
      format: 'rdf-json',
      source: cachedJsonPath,
      records: JSON.parse(readFileSync(cachedJsonPath, 'utf8')),
    };
  }

  if (useCsv) {
    const csvText = await fetchText(LINKDATA_CSV_URL);
    writeFileSync(cachedCsvPath, csvText);
    return {
      format: 'csv',
      source: LINKDATA_CSV_URL,
      records: parseLinkDataCsv(csvText),
    };
  }

  const jsonText = await fetchText(LINKDATA_RDF_JSON_URL);
  writeFileSync(cachedJsonPath, jsonText);
  const records = JSON.parse(jsonText);
  return {
    format: 'rdf-json',
    source: LINKDATA_RDF_JSON_URL,
    records,
  };
}

async function main() {
  const loaded = await loadSourceRecords();
  const { stations, skipped } = transformLinkDataRdf(loaded.records);

  writeFileSync(assetsPath, `${JSON.stringify(stations, null, 2)}\n`);

  const skippedByReason = skipped.reduce((acc, item) => {
    acc[item.reason] = (acc[item.reason] ?? 0) + 1;
    return acc;
  }, {});

  const report = {
    generatedAt: new Date().toISOString(),
    source: loaded.source,
    format: loaded.format,
    stationCount: stations.length,
    skippedCount: skipped.length,
    skippedByReason,
    attribution:
      '「国土数値情報（道の駅データ）」（国土交通省）をもとに東京福祉専門学校IT医療ソーシャルワーカー科作成（LinkData rdf1s2861i）',
  };

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Wrote ${stations.length} stations to ${assetsPath}`);
  console.log(`Skipped ${skipped.length} records (${JSON.stringify(skippedByReason)})`);
  console.log(`Report: ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
