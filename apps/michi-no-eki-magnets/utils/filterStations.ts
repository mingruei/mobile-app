import {
  getStationLocationFilterKey,
  HOKKAIDO_AREA_IDS,
  isHokkaidoAreaId,
} from '../constants/hokkaidoAreas';
import { normalizePrefectureKey } from '../constants/prefectureKeys';
import type { RegionId } from '../constants/regions';
import { getRegionIdForPrefecture } from '../constants/regions';
import type { StationServiceId } from '../constants/stationServices';
import { stationHasServices } from '../constants/stationServices';
import type { Station, ProgressFilter } from '../types/station';
import {
  EMPTY_STATION_PROGRESS_ENTRY,
  type StationProgressMap,
} from '../types/stationProgress';

export type StationFilters = {
  regionId: RegionId | null;
  prefecture: string | null;
  selectedServices: readonly StationServiceId[];
  progressFilter: ProgressFilter;
  progressMap?: StationProgressMap;
  groupStationIdSet?: ReadonlySet<number>;
  /** Text search on station name and address; combined with other filters. */
  nameQuery?: string;
};

function matchesLocationFilters(station: Station, filters: StationFilters): boolean {
  const stationRegionId = getRegionIdForPrefecture(station.prefecture);

  if (filters.regionId && stationRegionId !== filters.regionId) {
    return false;
  }

  if (filters.prefecture) {
    const filterKey = normalizePrefectureKey(filters.prefecture);
    const stationKey = normalizePrefectureKey(getStationLocationFilterKey(station));

    if (filterKey !== stationKey) {
      return false;
    }
  }

  return true;
}

function includesCaseless(haystack: string, needle: string): boolean {
  return haystack.toLocaleLowerCase('en-US').includes(needle.toLocaleLowerCase('en-US'));
}

function matchesTextQuery(station: Station, query: string): boolean {
  if (includesCaseless(station.name, query)) {
    return true;
  }

  if (station.nameEn && includesCaseless(station.nameEn, query)) {
    return true;
  }

  if (includesCaseless(station.location, query)) {
    return true;
  }

  return false;
}

function matchesProgressFilter(
  stationId: number,
  progressFilter: ProgressFilter,
  progressMap: StationProgressMap | undefined,
): boolean {
  if (progressFilter === 'all') {
    return true;
  }

  const progress = progressMap?.[stationId] ?? EMPTY_STATION_PROGRESS_ENTRY;

  switch (progressFilter) {
    case 'visited':
      return progress.visited;
    case 'not-visited':
      return !progress.visited;
    case 'has-magnet':
      return progress.magnet;
    case 'no-magnet':
      return !progress.magnet;
    default:
      return true;
  }
}

function matchesGroupFilter(
  stationId: number,
  groupStationIdSet: ReadonlySet<number> | undefined,
): boolean {
  if (!groupStationIdSet) {
    return true;
  }

  return groupStationIdSet.has(stationId);
}

function applyStationFilters(stations: readonly Station[], filters: StationFilters): Station[] {
  const nameQuery = filters.nameQuery?.trim() ?? '';

  return stations.filter(
    (station) =>
      matchesLocationFilters(station, filters) &&
      stationHasServices(station.services, filters.selectedServices) &&
      matchesProgressFilter(station.id, filters.progressFilter, filters.progressMap) &&
      matchesGroupFilter(station.id, filters.groupStationIdSet) &&
      (nameQuery.length === 0 || matchesTextQuery(station, nameQuery)),
  );
}

export function filterStations(
  stations: readonly Station[],
  filters: StationFilters,
): Station[] {
  return applyStationFilters(stations, filters);
}

export function getAvailablePrefectures(
  stations: readonly Station[],
  regionId: RegionId | null,
): string[] {
  const prefectures = new Set<string>();

  for (const station of stations) {
    if (regionId) {
      const stationRegionId = getRegionIdForPrefecture(station.prefecture);
      if (stationRegionId !== regionId) {
        continue;
      }
    }

    if (regionId === 'hokkaido') {
      const areaKey = getStationLocationFilterKey(station);
      if (isHokkaidoAreaId(areaKey)) {
        prefectures.add(areaKey);
      }
      continue;
    }

    prefectures.add(station.prefecture);
  }

  if (regionId === 'hokkaido') {
    return HOKKAIDO_AREA_IDS.filter((areaId) => prefectures.has(areaId));
  }

  return [...prefectures].sort((left, right) => left.localeCompare(right, 'ja'));
}
