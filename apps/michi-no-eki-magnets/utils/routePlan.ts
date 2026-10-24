import type { Station } from '../types/station';
import type { StationProgress } from '../types/stationProgress';
import {
  fetchDrivingRoutePolyline,
  GoogleRoutesError,
  type RouteRoadAvoidOptions,
} from './googleRoutes';
import { distanceInMeters } from './localPrefecture';
import { simplifyPolyline } from './polyline';

export type RouteEndpoint = {
  latitude: number;
  longitude: number;
};

export type FindStationsAlongRouteOptions = {
  corridorMeters?: number;
  maxResults?: number;
  roadAvoid?: RouteRoadAvoidOptions;
};

export const ROUTE_PLAN_ROAD_AVOID_KEYS = ['highways', 'tolls'] as const;

export type RoutePlanRoadAvoidKey = (typeof ROUTE_PLAN_ROAD_AVOID_KEYS)[number];

export function roadAvoidKeysToOptions(
  keys: ReadonlySet<RoutePlanRoadAvoidKey>,
): RouteRoadAvoidOptions {
  return {
    avoidHighways: keys.has('highways'),
    avoidTolls: keys.has('tolls'),
  };
}

export type RoutePlanResult = {
  stations: Station[];
  waypointStations: Station[];
};

export type RoutePlanSource = 'driving' | 'straight';

export type PlannedRouteResult = {
  result: RoutePlanResult;
  source: RoutePlanSource;
  warningMessage: string | null;
};

export function distanceToRouteSegmentMeters(
  point: RouteEndpoint,
  start: RouteEndpoint,
  end: RouteEndpoint,
): number {
  const deltaLongitude = end.longitude - start.longitude;
  const deltaLatitude = end.latitude - start.latitude;
  const lengthSquared = deltaLongitude * deltaLongitude + deltaLatitude * deltaLatitude;

  if (lengthSquared === 0) {
    return distanceInMeters(point.latitude, point.longitude, start.latitude, start.longitude);
  }

  let progress =
    ((point.longitude - start.longitude) * deltaLongitude +
      (point.latitude - start.latitude) * deltaLatitude) /
    lengthSquared;
  progress = Math.max(0, Math.min(1, progress));

  const closestLatitude = start.latitude + progress * deltaLatitude;
  const closestLongitude = start.longitude + progress * deltaLongitude;

  return distanceInMeters(point.latitude, point.longitude, closestLatitude, closestLongitude);
}

export function routeProgressAlongSegment(
  point: RouteEndpoint,
  start: RouteEndpoint,
  end: RouteEndpoint,
): number {
  const deltaLongitude = end.longitude - start.longitude;
  const deltaLatitude = end.latitude - start.latitude;
  const lengthSquared = deltaLongitude * deltaLongitude + deltaLatitude * deltaLatitude;

  if (lengthSquared === 0) {
    return 0;
  }

  const progress =
    ((point.longitude - start.longitude) * deltaLongitude +
      (point.latitude - start.latitude) * deltaLatitude) /
    lengthSquared;

  return Math.max(0, Math.min(1, progress));
}

export const DEFAULT_CORRIDOR_KM = 20;
export const MIN_CORRIDOR_KM = 5;
export const MAX_CORRIDOR_KM = 60;
export const CORRIDOR_STEP_KM = 5;

export const MAX_MAP_WAYPOINT_COUNT = 9;

export function corridorKmToMeters(kilometers: number): number {
  return Math.round(kilometers * 1000);
}

export function clampCorridorKm(kilometers: number): number {
  return Math.min(MAX_CORRIDOR_KM, Math.max(MIN_CORRIDOR_KM, kilometers));
}

export function clampMapWaypointCount(count: number): number {
  return Math.min(MAX_MAP_WAYPOINT_COUNT, Math.max(1, count));
}

export const ROUTE_PLAN_EXCLUDE_KEYS = ['visited', 'magnet', 'magnetNotSold'] as const;

export type RoutePlanExcludeKey = (typeof ROUTE_PLAN_EXCLUDE_KEYS)[number];

export function isRoutePlanStationExcluded(
  stationId: number,
  excludes: ReadonlySet<RoutePlanExcludeKey>,
  getProgress: (stationId: number) => StationProgress,
): boolean {
  if (excludes.size === 0) {
    return false;
  }

  const progress = getProgress(stationId);

  if (excludes.has('visited') && progress.visited) {
    return true;
  }
  if (excludes.has('magnet') && progress.magnet) {
    return true;
  }
  if (excludes.has('magnetNotSold') && progress.magnetNotSold) {
    return true;
  }

  return false;
}

export function filterStationsForRoutePlan(
  stations: readonly Station[],
  excludes: ReadonlySet<RoutePlanExcludeKey>,
  getProgress: (stationId: number) => StationProgress,
): Station[] {
  return stations.filter(
    (station) => !isRoutePlanStationExcluded(station.id, excludes, getProgress),
  );
}

export function distanceToPolylineMeters(
  point: RouteEndpoint,
  polyline: readonly RouteEndpoint[],
): { distanceMeters: number; progressMeters: number } {
  if (polyline.length === 0) {
    return { distanceMeters: Number.POSITIVE_INFINITY, progressMeters: 0 };
  }

  if (polyline.length === 1) {
    const only = polyline[0]!;
    return {
      distanceMeters: distanceInMeters(
        point.latitude,
        point.longitude,
        only.latitude,
        only.longitude,
      ),
      progressMeters: 0,
    };
  }

  let minDistance = Number.POSITIVE_INFINITY;
  let progressAtClosest = 0;
  let accumulatedMeters = 0;

  for (let index = 0; index < polyline.length - 1; index += 1) {
    const start = polyline[index]!;
    const end = polyline[index + 1]!;
    const segmentLength = distanceInMeters(
      start.latitude,
      start.longitude,
      end.latitude,
      end.longitude,
    );
    const distanceToSegment = distanceToRouteSegmentMeters(point, start, end);
    const segmentProgress = routeProgressAlongSegment(point, start, end);
    const progressMeters = accumulatedMeters + segmentProgress * segmentLength;

    if (distanceToSegment < minDistance) {
      minDistance = distanceToSegment;
      progressAtClosest = progressMeters;
    }

    accumulatedMeters += segmentLength;
  }

  return { distanceMeters: minDistance, progressMeters: progressAtClosest };
}

export function findStationsAlongPolyline(
  stations: readonly Station[],
  polyline: readonly RouteEndpoint[],
  options: FindStationsAlongRouteOptions = {},
): RoutePlanResult {
  const corridorMeters =
    options.corridorMeters ?? corridorKmToMeters(DEFAULT_CORRIDOR_KM);
  const maxResults = options.maxResults;
  const corridorPolyline = simplifyPolyline(polyline);

  const matched = stations
    .map((station) => {
      const endpoint = {
        latitude: station.latitude,
        longitude: station.longitude,
      };
      const { distanceMeters, progressMeters } = distanceToPolylineMeters(
        endpoint,
        corridorPolyline,
      );
      return {
        station,
        distanceMeters,
        progressMeters,
      };
    })
    .filter((item) => item.distanceMeters <= corridorMeters)
    .sort((left, right) => left.progressMeters - right.progressMeters)
    .map((item) => item.station);

  const listedStations =
    maxResults != null ? matched.slice(0, maxResults) : matched;

  return {
    stations: listedStations,
    waypointStations: listedStations,
  };
}

export async function planDrivingRouteStations(
  stations: readonly Station[],
  origin: RouteEndpoint,
  destination: RouteEndpoint,
  options: FindStationsAlongRouteOptions = {},
): Promise<PlannedRouteResult> {
  try {
    const polyline = await fetchDrivingRoutePolyline(
      origin,
      destination,
      options.roadAvoid ?? { avoidHighways: false, avoidTolls: false },
    );
    return {
      result: findStationsAlongPolyline(stations, polyline, options),
      source: 'driving',
      warningMessage: null,
    };
  } catch (error) {
    const warningMessage =
      error instanceof GoogleRoutesError
        ? error.message
        : 'Driving route lookup failed';

    return {
      result: findStationsAlongRoute(stations, origin, destination, options),
      source: 'straight',
      warningMessage,
    };
  }
}

export function findStationsAlongRoute(
  stations: readonly Station[],
  origin: RouteEndpoint,
  destination: RouteEndpoint,
  options: FindStationsAlongRouteOptions = {},
): RoutePlanResult {
  const corridorMeters =
    options.corridorMeters ?? corridorKmToMeters(DEFAULT_CORRIDOR_KM);
  const maxResults = options.maxResults;

  const matched = stations
    .map((station) => {
      const endpoint = {
        latitude: station.latitude,
        longitude: station.longitude,
      };
      return {
        station,
        distanceToRoute: distanceToRouteSegmentMeters(endpoint, origin, destination),
        progress: routeProgressAlongSegment(endpoint, origin, destination),
      };
    })
    .filter((item) => item.distanceToRoute <= corridorMeters)
    .sort((left, right) => left.progress - right.progress)
    .map((item) => item.station);

  const listedStations =
    maxResults != null ? matched.slice(0, maxResults) : matched;

  return { stations: listedStations, waypointStations: listedStations };
}

export function pickWaypointStations(stations: readonly Station[], maxWaypoints: number): Station[] {
  const limit = clampMapWaypointCount(maxWaypoints);

  if (stations.length === 0) {
    return [];
  }

  if (stations.length <= limit) {
    return [...stations];
  }

  if (limit <= 1) {
    return [stations[Math.floor((stations.length - 1) / 2)]!];
  }

  const picked: Station[] = [];
  const lastIndex = stations.length - 1;

  for (let index = 0; index < limit; index += 1) {
    const sourceIndex = Math.round((index / (limit - 1)) * lastIndex);
    picked.push(stations[sourceIndex]!);
  }

  return picked;
}
