import {
  getStationLocationFilterKey,
  HOKKAIDO_AREA_IDS,
  isHokkaidoAreaId,
} from '../constants/hokkaidoAreas';
import { normalizePrefectureKey } from '../constants/prefectureKeys';
import type { StationServiceId } from '../constants/stationServices';
import { stationHasServices } from '../constants/stationServices';
import type { Station, ProgressFilter } from '../types/station';
import { getStationDisplayName, getStationLocation } from './stationName';
import {
  EMPTY_STATION_PROGRESS_ENTRY,
  type StationProgressMap,
} from '../types/stationProgress';

export type StationFilters = {
  prefecture: string | null;
  selectedServices: readonly StationServiceId[];
  progressFilter: ProgressFilter;
  progressMap?: StationProgressMap;
  groupStationIdSet?: ReadonlySet<number>;
  /** Text search on municipality name, English name, and address; combined with other filters. */
  nameQuery?: string;
};

function matchesLocationFilters(station: Station, filters: StationFilters): boolean {
  if (!filters.prefecture) {
    return true;
  }

  const filterKey = normalizePrefectureKey(filters.prefecture);
  const stationKey = normalizePrefectureKey(getStationLocationFilterKey(station));

  return filterKey === stationKey;
}

function includesCaseless(haystack: string, needle: string): boolean {
  return haystack.toLocaleLowerCase('en-US').includes(needle.toLocaleLowerCase('en-US'));
}

function matchesTextQuery(station: Station, query: string): boolean {
  if (includesCaseless(station.name, query)) {
    return true;
  }

  const nameZh = station.nameZh?.trim();
  if (nameZh && includesCaseless(nameZh, query)) {
    return true;
  }

  if (station.nameEn && includesCaseless(station.nameEn, query)) {
    return true;
  }

  if (includesCaseless(station.location, query)) {
    return true;
  }

  if (includesCaseless(getStationLocation(station), query)) {
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

export function getAvailablePrefectures(stations: readonly Station[]): string[] {
  const prefectures = new Set<string>();

  for (const station of stations) {
    const areaKey = getStationLocationFilterKey(station);
    if (isHokkaidoAreaId(areaKey)) {
      prefectures.add(areaKey);
    }
  }

  return HOKKAIDO_AREA_IDS.filter((areaId) => prefectures.has(areaId));
}
