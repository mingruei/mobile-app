import { haversineKm } from './haversine.ts';
import type {
  ClusterResult,
  CorridorAnchor,
  CorridorAnchors,
  LatLng,
  Outlier,
  Region,
  SimPlace,
} from './types.ts';

export type CorridorFilterResult = {
  cluster: ClusterResult;
  corridor: CorridorAnchors;
  corridorMaxKm: number;
  movedToPending: Outlier[];
};

function projectFraction(point: LatLng, start: LatLng, end: LatLng): number {
  const dx = end.longitude - start.longitude;
  const dy = end.latitude - start.latitude;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return 0;
  const t =
    ((point.longitude - start.longitude) * dx + (point.latitude - start.latitude) * dy) /
    len2;
  return Math.max(0, Math.min(1, t));
}

function distanceToSegmentKm(point: LatLng, start: LatLng, end: LatLng): number {
  const t = projectFraction(point, start, end);
  const closest: LatLng = {
    latitude: start.latitude + t * (end.latitude - start.latitude),
    longitude: start.longitude + t * (end.longitude - start.longitude),
  };
  return haversineKm(point, closest);
}

export function filterClusterByCorridor(
  places: readonly SimPlace[],
  cluster: ClusterResult,
  corridor: CorridorAnchors,
  corridorMaxKm: number,
): CorridorFilterResult {
  const keptRegions: Region[] = [];
  const movedToPending: Outlier[] = [...cluster.outliers];

  for (const region of cluster.regions) {
    const d = distanceToSegmentKm(region.centroid, corridor.start, corridor.end);
    if (d > corridorMaxKm) {
      for (const placeIndex of region.placeIndexes) {
        movedToPending.push({
          placeIndex,
          nearestRegionId: region.regionId,
          distanceKm: d,
          reason: 'corridor',
        });
      }
      continue;
    }
    keptRegions.push(region);
  }

  const renumbered = keptRegions.map((region, idx) => ({
    ...region,
    regionId: `R${idx + 1}`,
  }));

  return {
    cluster: {
      ...cluster,
      regions: renumbered,
      outliers: movedToPending,
    },
    corridor,
    corridorMaxKm,
    movedToPending: movedToPending.filter((o) => o.reason === 'corridor'),
  };
}

export function sortRegionsAlongCorridor(
  regions: readonly Region[],
  corridor: CorridorAnchors,
): Region[] {
  return [...regions].sort(
    (a, b) =>
      projectFraction(a.centroid, corridor.start, corridor.end) -
      projectFraction(b.centroid, corridor.start, corridor.end),
  );
}

export function makeCorridor(start: CorridorAnchor, end: CorridorAnchor): CorridorAnchors {
  return { start, end };
}
