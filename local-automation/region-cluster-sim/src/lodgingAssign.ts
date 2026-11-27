import { haversineKm } from './haversine.ts';
import type {
  CapacityParams,
  CapacityResult,
  ClusterResult,
  DayDraft,
  DayStopDraft,
  LodgingSchedule,
  Outlier,
  SimPlace,
} from './types.ts';
import { DEFAULT_CAPACITY_PARAMS } from './capacity.ts';

export type LodgingAssignOptions = {
  places: readonly SimPlace[];
  cluster: ClusterResult;
  lodging: LodgingSchedule;
  existingDayCount: number;
  params?: Partial<CapacityParams>;
  mustVisitIndexes?: ReadonlySet<number>;
  lodgingBiasKm?: number;
};

function placePoint(place: SimPlace) {
  return { latitude: place.latitude, longitude: place.longitude };
}

function lodgingPoint(lodging: LodgingSchedule, dayIndex: number) {
  const night = lodging.nights.find((n) => n.dayIndex === dayIndex);
  if (!night) return null;
  return {
    label: night.lodging.label,
    latitude: night.lodging.latitude,
    longitude: night.lodging.longitude,
  };
}

/**
 * Score a place against a day's lodging. Lower is better.
 * lodgingBiasKm soft-pulls borderline places toward their booked night city.
 */
function scorePlaceForDay(
  place: SimPlace,
  dayIndex: number,
  lodging: LodgingSchedule,
  lodgingBiasKm: number,
): number {
  const tonight = lodgingPoint(lodging, dayIndex);
  if (!tonight) return Infinity;
  const toTonight = haversineKm(placePoint(place), tonight);

  const prev = lodgingPoint(lodging, dayIndex - 1);
  const start =
    dayIndex === 1 && lodging.tripStart
      ? lodging.tripStart
      : prev;

  const fromStart = start
    ? haversineKm(placePoint(place), start)
    : toTonight;

  // Prefer places near tonight's lodging, with a soft pull from the day's start.
  return toTonight + 0.35 * fromStart - lodgingBiasKm * 0.15;
}

export function assignDaysByLodging(options: LodgingAssignOptions): CapacityResult {
  const {
    places,
    cluster,
    lodging,
    existingDayCount,
    mustVisitIndexes = new Set(),
    lodgingBiasKm = 25,
  } = options;
  const params: CapacityParams = {
    ...DEFAULT_CAPACITY_PARAMS,
    ...options.params,
  };

  const dayIndexes = lodging.nights
    .map((n) => n.dayIndex)
    .filter((d) => d >= 1 && d <= existingDayCount)
    .sort((a, b) => a - b);

  const assigned = new Map<number, number>(); // placeIndex -> dayIndex
  const pending: Outlier[] = [...cluster.outliers];
  const candidateIndexes = new Set<number>();

  for (const region of cluster.regions) {
    for (const idx of region.placeIndexes) candidateIndexes.add(idx);
  }
  // Must-visit places are always candidates even if corridor/cluster dropped them.
  for (const idx of mustVisitIndexes) candidateIndexes.add(idx);

  // Remove must/pending duplicates from pending if they are now candidates.
  const pendingFiltered = pending.filter((o) => !mustVisitIndexes.has(o.placeIndex));

  // Greedy: assign each place to best lodging day under capacity.
  const dayStops = new Map<number, number[]>();
  for (const d of dayIndexes) dayStops.set(d, []);

  const scored: Array<{ placeIndex: number; dayIndex: number; score: number }> = [];
  for (const placeIndex of candidateIndexes) {
    const place = places[placeIndex];
    if (!place?.hasCoords) continue;
    let bestDay = -1;
    let bestScore = Infinity;
    for (const dayIndex of dayIndexes) {
      const score = scorePlaceForDay(place, dayIndex, lodging, lodgingBiasKm);
      if (score < bestScore) {
        bestScore = score;
        bestDay = dayIndex;
      }
    }
    if (bestDay >= 0) {
      scored.push({ placeIndex, dayIndex: bestDay, score: bestScore });
    }
  }

  // Must-visit first, then by score.
  scored.sort((a, b) => {
    const am = mustVisitIndexes.has(a.placeIndex) ? 0 : 1;
    const bm = mustVisitIndexes.has(b.placeIndex) ? 0 : 1;
    if (am !== bm) return am - bm;
    return a.score - b.score;
  });

  for (const item of scored) {
    const place = places[item.placeIndex]!;
    const tonight = lodgingPoint(lodging, item.dayIndex);
    if (!tonight) continue;

    // Soft lodging gate: far from tonight's lodging goes to pending unless must-visit.
    const dist = haversineKm(placePoint(place), tonight);
    if (dist > lodgingBiasKm * 2.2 && !mustVisitIndexes.has(item.placeIndex)) {
      pendingFiltered.push({
        placeIndex: item.placeIndex,
        nearestRegionId: null,
        distanceKm: dist,
        reason: 'lodging',
      });
      continue;
    }

    let targetDay = item.dayIndex;
    let list = dayStops.get(targetDay)!;

    if (list.length >= params.maxStopsPerDay) {
      // Spill to another night with the same lodging label if possible
      // (prefer emptier same-label days; works for must-visit too).
      const sameLabelDays = dayIndexes
        .filter((d) => {
          const n = lodgingPoint(lodging, d);
          return (
            n &&
            n.label === tonight.label &&
            (dayStops.get(d)?.length ?? 0) < params.maxStopsPerDay
          );
        })
        .sort(
          (a, b) =>
            (dayStops.get(a)?.length ?? 0) - (dayStops.get(b)?.length ?? 0),
        );
      if (sameLabelDays.length > 0) {
        targetDay = sameLabelDays[0]!;
        list = dayStops.get(targetDay)!;
      } else if (!mustVisitIndexes.has(item.placeIndex)) {
        pendingFiltered.push({
          placeIndex: item.placeIndex,
          nearestRegionId: null,
          distanceKm: dist,
          reason: 'capacity',
        });
        continue;
      }
      // Must-visit may still exceed when every same-label day is full.
    }

    list.push(item.placeIndex);
    assigned.set(item.placeIndex, targetDay);
  }

  // Order stops within each day by distance from day's start.
  const days: DayDraft[] = [];
  for (const dayIndex of dayIndexes) {
    const indexes = dayStops.get(dayIndex) ?? [];
    const prev = lodgingPoint(lodging, dayIndex - 1);
    const start =
      dayIndex === 1 && lodging.tripStart
        ? lodging.tripStart
        : prev ?? lodgingPoint(lodging, dayIndex);
    const ordered = [...indexes].sort((a, b) => {
      if (!start) return a - b;
      return (
        haversineKm(placePoint(places[a]!), start) -
        haversineKm(placePoint(places[b]!), start)
      );
    });
    const stops: DayStopDraft[] = ordered.map((placeIndex) => ({
      placeIndex,
      regionId: 'lodging',
      dwellMinutes: params.defaultDwellMinutes,
      notes: mustVisitIndexes.has(placeIndex) ? 'must-visit' : '',
    }));
    const night = lodgingPoint(lodging, dayIndex);
    days.push({
      dayIndex,
      regionIds: ['lodging'],
      stops,
      summary: night ? `住宿：${night.label}` : '',
    });
  }

  // Truncate/pad to existingDayCount for report stability.
  const trimmed = days.filter((d) => d.dayIndex <= existingDayCount);
  while (trimmed.length < existingDayCount) {
    const next = trimmed.length + 1;
    trimmed.push({
      dayIndex: next,
      regionIds: ['lodging'],
      stops: [],
      summary: '',
    });
  }

  return {
    days: trimmed,
    suggestedDayCount: trimmed.filter((d) => d.stops.length > 0).length,
    existingDayCount,
    fitsTripDays: true,
    extraDaysNeeded: 0,
    pendingUserDecision: pendingFiltered,
    params,
  };
}
