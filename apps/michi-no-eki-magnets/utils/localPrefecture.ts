import * as Location from 'expo-location';

import type { RegionId } from '../constants/regions';
import { getRegionIdForPrefecture } from '../constants/regions';
import { getHokkaidoArea } from '../constants/hokkaidoAreas';
import { normalizePrefectureKey } from '../constants/prefectureKeys';
import type { Station } from '../types/station';

export const NEARBY_CASTLE_RADIUS_METERS = 1000;

export type LocalPrefectureFilter = {
  regionId: RegionId;
  prefecture: string;
};

export type LocalStartupContext = {
  filter: LocalPrefectureFilter | null;
  nearbyStation: Station | null;
};

type PrefectureCentroid = {
  prefecture: string;
  latitude: number;
  longitude: number;
};

type JapanCoordinates = {
  latitude: number;
  longitude: number;
};

const JAPAN_BOUNDS = {
  minLatitude: 24,
  maxLatitude: 46.5,
  minLongitude: 122,
  maxLongitude: 154,
};

const EARTH_RADIUS_METERS = 6_371_000;

function isInJapan(latitude: number, longitude: number): boolean {
  return (
    latitude >= JAPAN_BOUNDS.minLatitude &&
    latitude <= JAPAN_BOUNDS.maxLatitude &&
    longitude >= JAPAN_BOUNDS.minLongitude &&
    longitude <= JAPAN_BOUNDS.maxLongitude
  );
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function distanceInMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);
  const latA = toRadians(latitudeA);
  const latB = toRadians(latitudeB);

  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLongitude / 2) ** 2;

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function buildPrefectureCentroids(stations: readonly Station[]): PrefectureCentroid[] {
  const totals = new Map<string, { latitude: number; longitude: number; count: number }>();

  for (const station of stations) {
    if (!station.prefecture) {
      continue;
    }

    const current = totals.get(station.prefecture) ?? { latitude: 0, longitude: 0, count: 0 };
    totals.set(station.prefecture, {
      latitude: current.latitude + station.latitude,
      longitude: current.longitude + station.longitude,
      count: current.count + 1,
    });
  }

  return [...totals.entries()].map(([prefecture, value]) => ({
    prefecture,
    latitude: value.latitude / value.count,
    longitude: value.longitude / value.count,
  }));
}

function distanceSquared(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const deltaLatitude = latitudeA - latitudeB;
  const deltaLongitude = longitudeA - longitudeB;
  return deltaLatitude * deltaLatitude + deltaLongitude * deltaLongitude;
}

function findNearestPrefecture(
  latitude: number,
  longitude: number,
  centroids: readonly PrefectureCentroid[],
): string | null {
  let nearestPrefecture: string | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const centroid of centroids) {
    const distance = distanceSquared(
      latitude,
      longitude,
      centroid.latitude,
      centroid.longitude,
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestPrefecture = centroid.prefecture;
    }
  }

  return nearestPrefecture;
}

/** English / alternate labels commonly returned by reverse geocoders. */
const PREFECTURE_NAME_ALIASES: Record<string, string> = {
  hokkaido: '北海道',
  aomori: '青森県',
  iwate: '岩手県',
  miyagi: '宮城県',
  akita: '秋田県',
  yamagata: '山形県',
  fukushima: '福島県',
  ibaraki: '茨城県',
  tochigi: '栃木県',
  gunma: '群馬県',
  saitama: '埼玉県',
  chiba: '千葉県',
  tokyo: '東京都',
  kanagawa: '神奈川県',
  niigata: '新潟県',
  toyama: '富山県',
  ishikawa: '石川県',
  fukui: '福井県',
  yamanashi: '山梨県',
  nagano: '長野県',
  gifu: '岐阜県',
  shizuoka: '静岡県',
  aichi: '愛知県',
  mie: '三重県',
  shiga: '滋賀県',
  kyoto: '京都府',
  osaka: '大阪府',
  hyogo: '兵庫県',
  nara: '奈良県',
  wakayama: '和歌山県',
  tottori: '鳥取県',
  shimane: '島根県',
  okayama: '岡山県',
  hiroshima: '広島県',
  yamaguchi: '山口県',
  tokushima: '徳島県',
  kagawa: '香川県',
  ehime: '愛媛県',
  kochi: '高知県',
  fukuoka: '福岡県',
  saga: '佐賀県',
  nagasaki: '長崎県',
  kumamoto: '熊本県',
  oita: '大分県',
  miyazaki: '宮崎県',
  kagoshima: '鹿児島県',
  okinawa: '沖縄県',
};

function stripPrefectureSuffix(value: string): string {
  return value
    .replace(/(都|道|府|県|縣)$/u, '')
    .replace(/[-\s]*(prefecture|fu|ken|to|do)$/iu, '')
    .trim();
}

export function normalizePrefectureName(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  // Traditional Chinese labels (島根縣) → Japanese keys (島根県)
  const fromLocaleKey = normalizePrefectureKey(trimmed);
  if (getRegionIdForPrefecture(fromLocaleKey)) {
    return fromLocaleKey;
  }

  // English / romanized labels from Apple/Google reverse geocode
  const aliasKey = stripPrefectureSuffix(trimmed).toLowerCase().replace(/\s+/g, '');
  const fromAlias = PREFECTURE_NAME_ALIASES[aliasKey];
  if (fromAlias) {
    return fromAlias;
  }

  if (
    trimmed.endsWith('県') ||
    trimmed.endsWith('府') ||
    trimmed.endsWith('都') ||
    trimmed === '北海道'
  ) {
    return getRegionIdForPrefecture(trimmed) ? trimmed : null;
  }

  const withKen = `${trimmed}県`;
  return getRegionIdForPrefecture(withKen) ? withKen : null;
}

async function resolvePrefectureFromReverseGeocode(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    const first = results[0];
    if (!first) {
      return null;
    }

    return (
      normalizePrefectureName(first.region) ??
      normalizePrefectureName(first.subregion) ??
      normalizePrefectureName(first.district)
    );
  } catch {
    return null;
  }
}

async function getCurrentJapanCoordinates(): Promise<JapanCoordinates | null> {
  try {
    const existing = await Location.getForegroundPermissionsAsync();
    const permission =
      existing.status === 'undetermined'
        ? await Location.requestForegroundPermissionsAsync()
        : existing;

    if (permission.status !== 'granted') {
      return null;
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const { latitude, longitude } = position.coords;

    if (!isInJapan(latitude, longitude)) {
      return null;
    }

    return { latitude, longitude };
  } catch {
    return null;
  }
}

function filterFromPrefecture(
  prefecture: string | null | undefined,
  city?: string | null,
): LocalPrefectureFilter | null {
  if (!prefecture) {
    return null;
  }

  const canonical = normalizePrefectureName(prefecture) ?? normalizePrefectureKey(prefecture);
  const regionId = getRegionIdForPrefecture(canonical);
  if (!regionId) {
    return null;
  }

  if (canonical === '北海道' && city) {
    const area = getHokkaidoArea(city);
    if (area) {
      return { regionId, prefecture: area };
    }
  }

  return { regionId, prefecture: canonical };
}

async function resolvePrefectureFilter(
  stations: readonly Station[],
  latitude: number,
  longitude: number,
): Promise<LocalPrefectureFilter | null> {
  if (stations.length === 0) {
    return null;
  }

  // 1) Administrative reverse geocode is the source of truth for "which prefecture
  // am I in?". Nearest-station heuristics mislabel border towns when the closest
  // famous station sits across a prefecture line.
  const geocodedPrefecture = await resolvePrefectureFromReverseGeocode(latitude, longitude);
  const fromGeocode = filterFromPrefecture(geocodedPrefecture);
  if (fromGeocode && fromGeocode.prefecture !== '北海道') {
    return fromGeocode;
  }

  // 2) Prefer nearest station for Hokkaido sub-areas (geocode only returns 北海道).
  // all stations in a prefecture (Shimane centroid is near Matsue, so Tsuwano was
  // wrongly labeled Yamaguchi).
  const nearestCastle = findNearestCastleWithinRadius(
    stations,
    latitude,
    longitude,
    Number.POSITIVE_INFINITY,
  );
  const fromNearestCastle = filterFromPrefecture(
    nearestCastle?.prefecture,
    nearestCastle?.city,
  );
  if (fromNearestCastle) {
    return fromNearestCastle;
  }

  // 3) Last resort: prefecture station-centroid distance.
  const centroids = buildPrefectureCentroids(stations);
  const nearestPrefecture = findNearestPrefecture(latitude, longitude, centroids);
  const nearestStationInPrefecture = nearestPrefecture
    ? findNearestCastleWithinRadius(
        stations.filter((station) => station.prefecture === nearestPrefecture),
        latitude,
        longitude,
        Number.POSITIVE_INFINITY,
      )
    : null;

  return filterFromPrefecture(nearestPrefecture, nearestStationInPrefecture?.city);
}

export function findNearestCastleWithinRadius(
  stations: readonly Station[],
  latitude: number,
  longitude: number,
  radiusMeters: number,
): Station | null {
  let nearestCastle: Station | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const station of stations) {
    const distance = distanceInMeters(latitude, longitude, station.latitude, station.longitude);
    if (distance > radiusMeters || distance >= nearestDistance) {
      continue;
    }

    nearestDistance = distance;
    nearestCastle = station;
  }

  return nearestCastle;
}

export async function resolveLocalStartupContext(
  stations: readonly Station[],
  radiusMeters = NEARBY_CASTLE_RADIUS_METERS,
): Promise<LocalStartupContext> {
  const coordinates = await getCurrentJapanCoordinates();
  if (!coordinates) {
    return { filter: null, nearbyStation: null };
  }

  const { latitude, longitude } = coordinates;
  const [filter, nearbyStation] = await Promise.all([
    resolvePrefectureFilter(stations, latitude, longitude),
    Promise.resolve(findNearestCastleWithinRadius(stations, latitude, longitude, radiusMeters)),
  ]);

  return { filter, nearbyStation };
}

export async function resolveLocalPrefectureFilter(
  stations: readonly Station[],
): Promise<LocalPrefectureFilter | null> {
  const context = await resolveLocalStartupContext(stations);
  return context.filter;
}
