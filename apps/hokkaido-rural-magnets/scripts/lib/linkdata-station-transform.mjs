/** @typedef {import('../../types/station').Station} Station */

export const LINKDATA_CSV_URL = 'http://linkdata.org/api/1/rdf1s2861i/roadside_station.csv';
export const LINKDATA_RDF_JSON_URL =
  'http://linkdata.org/api/1/rdf1s2861i/roadside_station_rdf.json';

/** Active or soon-to-open stations included in the app list. */
export const INCLUDED_STATUSES = new Set(['営業中', '開業予定', '建設中']);

export const RDF_KEYS = {
  id: 'https://imilite.org/ID',
  name: 'https://imilite.org/名称',
  nameEn: 'https://imilite.org/英語表記',
  summary: 'https://imilite.org/概要',
  status: 'https://imilite.org/状態',
  address: 'https://imilite.org/住所',
  latitude: 'http://www.w3.org/2003/01/geo/wgs84_pos#lat',
  longitude: 'http://www.w3.org/2003/01/geo/wgs84_pos#long',
  prefecture: 'https://imilite.org/都道府県',
  city: 'https://imilite.org/市区町村',
  website: 'https://imilite.org/Webサイト',
  route: 'https://it-social.net/roadside_station/登録路線',
  designatedYear: 'https://linkingopendata.com/local/指定年',
  designatedMonth: 'https://linkingopendata.com/local/指定月',
  designatedDay: 'https://linkingopendata.com/local/指定日',
};

/** CSV column -> StationServiceId. Keys use https://it-social.net/roadside_station/service#id */
export const SERVICE_CSV_COLUMNS = {
  atm: 'ATM',
  babyBed: 'ベビーベッド',
  restaurant: 'レストラン',
  cafe: '軽食喫茶',
  lodging: '宿泊施設',
  hotSpring: '温泉施設',
  camping: 'キャンプ場等',
  park: '公園',
  observatory: '展望台',
  museum: '美術館博物館',
  gasStation: 'ガソリンスタンド',
  evCharging: 'EV充電施設',
  wifi: '無線LAN',
  shower: 'シャワー',
  experience: '体験施設',
  touristInfo: '観光案内',
  accessibleRestroom: '身障者トイレ',
  shop: 'ショップ',
  minatoOasis: 'みなとオアシス',
};

function serviceRdfKey(serviceId) {
  return `https://it-social.net/roadside_station/service#${serviceId}`;
}

/**
 * @param {Record<string, Array<{ value?: string }>>} entry
 */
export function parseServices(entry) {
  /** @type {string[]} */
  const services = [];

  for (const [serviceId] of Object.entries(SERVICE_CSV_COLUMNS)) {
    const value = literal(entry, serviceRdfKey(serviceId));
    if (value === '1') {
      services.push(serviceId);
    }
  }

  return services;
}

/**
 * @param {Record<string, Array<{ value?: string }>>} entry
 * @param {string} key
 */
export function literal(entry, key) {
  const value = entry[key]?.[0]?.value;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/**
 * @param {string | null | undefined} value
 */
export function parseCoordinate(value) {
  if (value == null || value.trim() === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * @param {string | null | undefined} value
 */
export function parseLinkDataId(value) {
  if (value == null || !/^\d+$/.test(value.trim())) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * @param {{
 *   linkdataId: string;
 *   designatedYear: string | null;
 *   designatedMonth: string | null;
 *   designatedDay: string | null;
 * }} row
 */
export function designationSortKey(row) {
  const year = Number.parseInt(row.designatedYear ?? '0', 10) || 0;
  const month = Number.parseInt(row.designatedMonth ?? '0', 10) || 0;
  const day = Number.parseInt(row.designatedDay ?? '0', 10) || 0;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}-${row.linkdataId}`;
}

/**
 * @param {Record<string, Record<string, Array<{ value?: string }>>>} records
 * @returns {{ stations: Station[]; skipped: Array<{ linkdataId: string; name: string | null; reason: string }> }}
 */
export function transformLinkDataRdf(records) {
  /** @type {Array<Record<string, string | null> & { services?: string[] }>} */
  const rows = Object.values(records).map((entry) => ({
    linkdataId: literal(entry, RDF_KEYS.id),
    name: literal(entry, RDF_KEYS.name),
    nameEn: literal(entry, RDF_KEYS.nameEn),
    summary: literal(entry, RDF_KEYS.summary),
    status: literal(entry, RDF_KEYS.status),
    address: literal(entry, RDF_KEYS.address),
    latitude: literal(entry, RDF_KEYS.latitude),
    longitude: literal(entry, RDF_KEYS.longitude),
    prefecture: literal(entry, RDF_KEYS.prefecture),
    city: literal(entry, RDF_KEYS.city),
    website: literal(entry, RDF_KEYS.website),
    route: literal(entry, RDF_KEYS.route),
    designatedYear: literal(entry, RDF_KEYS.designatedYear),
    designatedMonth: literal(entry, RDF_KEYS.designatedMonth),
    designatedDay: literal(entry, RDF_KEYS.designatedDay),
    services: parseServices(entry),
  }));

  /** @type {Array<{ linkdataId: string; name: string | null; reason: string }>} */
  const skipped = [];

  /** @type {typeof rows} */
  const candidates = [];

  for (const row of rows) {
    if (!row.linkdataId) {
      skipped.push({ linkdataId: 'unknown', name: row.name, reason: 'missing-linkdata-id' });
      continue;
    }

    if (!row.status || !INCLUDED_STATUSES.has(row.status)) {
      skipped.push({ linkdataId: row.linkdataId, name: row.name, reason: `status:${row.status ?? 'empty'}` });
      continue;
    }

    if (!row.name || !row.prefecture || !row.city || !row.address) {
      skipped.push({ linkdataId: row.linkdataId, name: row.name, reason: 'missing-core-fields' });
      continue;
    }

    const latitude = parseCoordinate(row.latitude);
    const longitude = parseCoordinate(row.longitude);
    if (latitude == null || longitude == null) {
      skipped.push({ linkdataId: row.linkdataId, name: row.name, reason: 'missing-coordinates' });
      continue;
    }

    candidates.push({ ...row, latitude: String(latitude), longitude: String(longitude) });
  }

  candidates.sort((left, right) => {
    const byDesignation = designationSortKey(left).localeCompare(designationSortKey(right), 'ja');
    if (byDesignation !== 0) {
      return byDesignation;
    }

    return left.linkdataId.localeCompare(right.linkdataId, 'ja');
  });

  /** @type {Station[]} */
  const stations = [];
  const usedIds = new Set();

  candidates.forEach((row, index) => {
    const id = parseLinkDataId(row.linkdataId);
    if (id == null) {
      skipped.push({ linkdataId: row.linkdataId, name: row.name, reason: 'invalid-linkdata-id' });
      return;
    }

    if (usedIds.has(id)) {
      skipped.push({ linkdataId: row.linkdataId, name: row.name, reason: 'duplicate-linkdata-id' });
      return;
    }

    usedIds.add(id);

    /** @type {Station} */
    const station = {
      id,
      number: index + 1,
      name: row.name,
      nameEn: row.nameEn,
      prefecture: row.prefecture,
      city: row.city,
      location: row.address,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      shortDescription: row.summary,
      website: row.website,
      access: row.route,
      services: row.services ?? [],
    };

    stations.push(station);
  });

  return { stations, skipped };
}

/**
 * Parse LinkData CSV (already fetched) into the same row shape used by transformLinkDataRdf.
 * Minimal RFC4180 parser supporting quoted fields.
 *
 * @param {string} csvText
 */
export function parseLinkDataCsv(csvText) {
  /** @type {string[][]} */
  const rows = [];
  /** @type {string[]} */
  let current = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];

    if (inQuotes) {
      if (char === '"') {
        if (csvText[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      current.push(field);
      field = '';
      continue;
    }

    if (char === '\n') {
      current.push(field);
      rows.push(current);
      current = [];
      field = '';
      continue;
    }

    if (char === '\r') {
      continue;
    }

    field += char;
  }

  if (field.length > 0 || current.length > 0) {
    current.push(field);
    rows.push(current);
  }

  if (rows.length === 0) {
    return {};
  }

  const headers = rows[0];
  /** @type {Record<string, Record<string, Array<{ value?: string }>>>} */
  const records = {};

  for (const values of rows.slice(1)) {
    if (values.length === 1 && values[0] === '') {
      continue;
    }

    /** @type {Record<string, string>} */
    const row = {};
    headers.forEach((header, headerIndex) => {
      row[header] = values[headerIndex] ?? '';
    });

    const uri = row.roadside_station;
    if (!uri) {
      continue;
    }

    records[uri] = {
      [RDF_KEYS.id]: [{ value: row.ID }],
      [RDF_KEYS.name]: [{ value: row['名称'] }],
      [RDF_KEYS.nameEn]: [{ value: row['英語表記'] }],
      [RDF_KEYS.summary]: [{ value: row['概要'] }],
      [RDF_KEYS.status]: [{ value: row['状態'] }],
      [RDF_KEYS.address]: [{ value: row['住所'] }],
      [RDF_KEYS.latitude]: [{ value: row.lat }],
      [RDF_KEYS.longitude]: [{ value: row.long }],
      [RDF_KEYS.prefecture]: [{ value: row['都道府県'] }],
      [RDF_KEYS.city]: [{ value: row['市区町村'] }],
      [RDF_KEYS.website]: [{ value: row['Webサイト'] }],
      [RDF_KEYS.route]: [{ value: row['登録路線'] }],
      [RDF_KEYS.designatedYear]: [{ value: row['指定年'] }],
      [RDF_KEYS.designatedMonth]: [{ value: row['指定月'] }],
      [RDF_KEYS.designatedDay]: [{ value: row['指定日'] }],
    };

    for (const [serviceId, csvColumn] of Object.entries(SERVICE_CSV_COLUMNS)) {
      records[uri][serviceRdfKey(serviceId)] = [{ value: row[csvColumn] ?? '' }];
    }
  }

  return records;
}
