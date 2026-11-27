import { centroidOf, haversineKm, spanKmOf } from './haversine.ts';
import type { ClusterParams, ClusterResult, Outlier, Region, SimPlace } from './types.ts';

export const DEFAULT_CLUSTER_PARAMS: ClusterParams = {
  mergeKm: 18,
  farKm: 45,
  outlierKm: 55,
};

function placePoint(place: SimPlace) {
  return { latitude: place.latitude, longitude: place.longitude };
}

export function clusterPlaces(
  places: readonly SimPlace[],
  params: Partial<ClusterParams> = {},
): ClusterResult {
  const merged: ClusterParams = { ...DEFAULT_CLUSTER_PARAMS, ...params };
  const located = places.filter((p) => p.hasCoords);
  const unlocated = places.filter((p) => !p.hasCoords).map((p) => p.placeIndex);

  type SoftCluster = { members: number[] };
  const soft: SoftCluster[] = located.map((p) => ({ members: [p.placeIndex] }));

  const distanceBetween = (a: SoftCluster, b: SoftCluster): number => {
    let min = Infinity;
    for (const ai of a.members) {
      for (const bi of b.members) {
        const pa = places[ai]!;
        const pb = places[bi]!;
        min = Math.min(min, haversineKm(placePoint(pa), placePoint(pb)));
      }
    }
    return min;
  };

  let changed = true;
  while (changed && soft.length > 1) {
    changed = false;
    let bestI = -1;
    let bestJ = -1;
    let bestD = Infinity;
    for (let i = 0; i < soft.length; i += 1) {
      for (let j = i + 1; j < soft.length; j += 1) {
        const d = distanceBetween(soft[i]!, soft[j]!);
        if (d < bestD) {
          bestD = d;
          bestI = i;
          bestJ = j;
        }
      }
    }
    if (bestI >= 0 && bestJ >= 0 && bestD <= merged.mergeKm) {
      soft[bestI]!.members.push(...soft[bestJ]!.members);
      soft.splice(bestJ, 1);
      changed = true;
    }
  }

  const regions: Region[] = soft.map((cluster, idx) => {
    const pts = cluster.members.map((i) => placePoint(places[i]!));
    return {
      regionId: `R${idx + 1}`,
      placeIndexes: [...cluster.members].sort((a, b) => a - b),
      centroid: centroidOf(pts),
      spanKm: spanKmOf(pts),
    };
  });

  const outliers: Outlier[] = [];
  const kept: Region[] = [];

  for (const region of regions) {
    if (region.placeIndexes.length === 1) {
      const alone = region.placeIndexes[0]!;
      let nearestId: string | null = null;
      let nearestKm = Infinity;
      for (const other of regions) {
        if (other.regionId === region.regionId) continue;
        if (other.placeIndexes.length < 2 && other.spanKm === 0) continue;
        const d = haversineKm(region.centroid, other.centroid);
        if (d < nearestKm) {
          nearestKm = d;
          nearestId = other.regionId;
        }
      }
      if (nearestKm >= merged.outlierKm) {
        outliers.push({
          placeIndex: alone,
          nearestRegionId: nearestId,
          distanceKm: Number.isFinite(nearestKm) ? nearestKm : 0,
          reason: 'cluster',
        });
        continue;
      }
    }
    kept.push(region);
  }

  const renumbered = kept.map((region, idx) => ({
    ...region,
    regionId: `R${idx + 1}`,
  }));

  return {
    regions: renumbered,
    outliers,
    unlocated,
    params: merged,
  };
}
