import { haversineKm } from './haversine.ts';
import { sortRegionsAlongCorridor } from './corridor.ts';
import type {
  CapacityParams,
  CapacityResult,
  ClusterResult,
  CorridorAnchors,
  DayDraft,
  DayStopDraft,
  Outlier,
  Region,
  SimPlace,
} from './types.ts';

export const DEFAULT_CAPACITY_PARAMS: CapacityParams = {
  maxStopsPerDay: 4,
  maxRegionSpanKmPerDay: 80,
  defaultDwellMinutes: 90,
};

function placePoint(place: SimPlace) {
  return { latitude: place.latitude, longitude: place.longitude };
}

function orderPlacesInRegion(places: readonly SimPlace[], region: Region): number[] {
  if (region.placeIndexes.length <= 2) return [...region.placeIndexes];
  const remaining = new Set(region.placeIndexes);
  const ordered: number[] = [];
  let current = region.placeIndexes.reduce((best, idx) => {
    const d = haversineKm(placePoint(places[idx]!), region.centroid);
    const bestD = haversineKm(placePoint(places[best]!), region.centroid);
    return d < bestD ? idx : best;
  }, region.placeIndexes[0]!);
  ordered.push(current);
  remaining.delete(current);
  while (remaining.size > 0) {
    let next = -1;
    let best = Infinity;
    for (const idx of remaining) {
      const d = haversineKm(placePoint(places[current]!), placePoint(places[idx]!));
      if (d < best) {
        best = d;
        next = idx;
      }
    }
    ordered.push(next);
    remaining.delete(next);
    current = next;
  }
  return ordered;
}

export function assignDaysByCapacity(
  places: readonly SimPlace[],
  cluster: ClusterResult,
  existingDayCount: number,
  params: Partial<CapacityParams> = {},
  corridor: CorridorAnchors | null = null,
): CapacityResult {
  const merged: CapacityParams = { ...DEFAULT_CAPACITY_PARAMS, ...params };
  const regions = corridor
    ? sortRegionsAlongCorridor(cluster.regions, corridor)
    : [...cluster.regions];

  const days: DayDraft[] = [];
  let dayIndex = 1;
  let current: DayDraft | null = null;

  const flush = () => {
    if (current && current.stops.length > 0) {
      days.push(current);
      dayIndex += 1;
      current = null;
    }
  };

  for (const region of regions) {
    const ordered = orderPlacesInRegion(places, region);
    for (const placeIndex of ordered) {
      const stop: DayStopDraft = {
        placeIndex,
        regionId: region.regionId,
        dwellMinutes: merged.defaultDwellMinutes,
        notes: '',
      };
      if (!current) {
        current = {
          dayIndex,
          regionIds: [region.regionId],
          stops: [stop],
          summary: '',
        };
        continue;
      }
      const nextCount = current.stops.length + 1;
      const pts = [...current.stops.map((s) => placePoint(places[s.placeIndex]!)), placePoint(places[placeIndex]!)];
      let span = 0;
      for (let i = 0; i < pts.length; i += 1) {
        for (let j = i + 1; j < pts.length; j += 1) {
          span = Math.max(span, haversineKm(pts[i]!, pts[j]!));
        }
      }
      if (nextCount > merged.maxStopsPerDay || span > merged.maxRegionSpanKmPerDay) {
        flush();
        current = {
          dayIndex,
          regionIds: [region.regionId],
          stops: [stop],
          summary: '',
        };
      } else {
        if (!current.regionIds.includes(region.regionId)) {
          current.regionIds.push(region.regionId);
        }
        current.stops.push(stop);
      }
    }
  }
  flush();

  const suggestedDayCount = days.length;
  const fitsTripDays = suggestedDayCount <= existingDayCount;
  const extraDaysNeeded = Math.max(0, suggestedDayCount - existingDayCount);

  return {
    days,
    suggestedDayCount,
    existingDayCount,
    fitsTripDays,
    extraDaysNeeded,
    pendingUserDecision: [...cluster.outliers],
    params: merged,
  };
}

export function mergePending(
  a: readonly Outlier[],
  b: readonly Outlier[],
): Outlier[] {
  const map = new Map<number, Outlier>();
  for (const item of [...a, ...b]) {
    const prev = map.get(item.placeIndex);
    if (!prev || (item.distanceKm ?? 0) > (prev.distanceKm ?? 0)) {
      map.set(item.placeIndex, item);
    }
  }
  return [...map.values()].sort((x, y) => x.placeIndex - y.placeIndex);
}
