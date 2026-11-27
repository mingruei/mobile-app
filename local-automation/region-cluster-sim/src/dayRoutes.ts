import { fetchRouteLeg, type RouteEndpoint } from './googleRoutes.ts';
import type {
  DayDraft,
  DayRouteLeg,
  DayRoutePlan,
  LodgingSchedule,
  SimPlace,
} from './types.ts';

export type BuildDayRoutesOptions = {
  places: readonly SimPlace[];
  days: readonly DayDraft[];
  lodging: LodgingSchedule;
  dayBudgetMinutes?: number;
  avoidTolls?: boolean;
  apiKey?: string | null;
  fetchLeg?: typeof fetchRouteLeg;
};

type Waypoint = {
  label: string;
  point: RouteEndpoint;
};

function placePoint(place: SimPlace): RouteEndpoint {
  return { latitude: place.latitude, longitude: place.longitude };
}

function lodgingForDay(
  lodging: LodgingSchedule,
  dayIndex: number,
): { label: string; point: RouteEndpoint } | null {
  const night = lodging.nights.find((n) => n.dayIndex === dayIndex);
  if (!night) return null;
  return {
    label: night.lodging.label,
    point: {
      latitude: night.lodging.latitude,
      longitude: night.lodging.longitude,
    },
  };
}

/**
 * Build waypoint chain for a day:
 * Day 1 start = tripStart (airport) when present, else previous lodging;
 * other days start = previous night lodging;
 * end = today's lodging.
 */
export function buildDayWaypoints(
  places: readonly SimPlace[],
  day: DayDraft,
  lodging: LodgingSchedule,
): Waypoint[] {
  const waypoints: Waypoint[] = [];
  const todayLodging = lodgingForDay(lodging, day.dayIndex);
  const prevLodging = lodgingForDay(lodging, day.dayIndex - 1);

  let start: Waypoint | null = null;
  if (day.dayIndex === 1 && lodging.tripStart) {
    start = {
      label: lodging.tripStart.label,
      point: {
        latitude: lodging.tripStart.latitude,
        longitude: lodging.tripStart.longitude,
      },
    };
  } else if (prevLodging) {
    start = prevLodging;
  }

  if (start) waypoints.push(start);

  for (const stop of day.stops) {
    const place = places[stop.placeIndex];
    if (!place?.hasCoords) continue;
    waypoints.push({ label: place.label, point: placePoint(place) });
  }

  if (todayLodging) waypoints.push(todayLodging);
  return waypoints;
}

async function computeLeg(
  from: Waypoint,
  to: Waypoint,
  options: {
    avoidTolls?: boolean;
    apiKey?: string | null;
    fetchLeg: typeof fetchRouteLeg;
  },
): Promise<DayRouteLeg> {
  try {
    const result = await options.fetchLeg(from.point, to.point, {
      avoidTolls: options.avoidTolls,
      apiKey: options.apiKey,
    });
    return {
      fromLabel: from.label,
      toLabel: to.label,
      durationSeconds: result.durationSeconds,
      distanceMeters: result.distanceMeters,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      fromLabel: from.label,
      toLabel: to.label,
      durationSeconds: 0,
      distanceMeters: 0,
      error: message,
    };
  }
}

export async function buildDayRoutes(
  options: BuildDayRoutesOptions,
): Promise<DayRoutePlan[]> {
  const {
    places,
    days,
    lodging,
    dayBudgetMinutes = 600,
    avoidTolls = false,
    apiKey,
    fetchLeg = fetchRouteLeg,
  } = options;

  const plans: DayRoutePlan[] = [];

  for (const day of days) {
    const waypoints = buildDayWaypoints(places, day, lodging);
    const legs: DayRouteLeg[] = [];

    for (let i = 0; i < waypoints.length - 1; i += 1) {
      const from = waypoints[i]!;
      const to = waypoints[i + 1]!;
      legs.push(await computeLeg(from, to, { avoidTolls, apiKey, fetchLeg }));
    }

    const totalDriveSeconds = legs.reduce((sum, leg) => sum + leg.durationSeconds, 0);
    const totalDistanceMeters = legs.reduce((sum, leg) => sum + leg.distanceMeters, 0);
    const totalDwellMinutes = day.stops.reduce((sum, stop) => sum + stop.dwellMinutes, 0);
    const dayLoadMinutes = Math.round(totalDriveSeconds / 60) + totalDwellMinutes;

    plans.push({
      dayIndex: day.dayIndex,
      legs,
      totalDriveSeconds,
      totalDistanceMeters,
      totalDwellMinutes,
      dayLoadMinutes,
      overBudget: dayLoadMinutes > dayBudgetMinutes,
    });
  }

  return plans;
}
