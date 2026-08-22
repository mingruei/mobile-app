import { getStationLocationFilterKey } from '../constants/hokkaidoAreas';
import { REGIONS, getRegionIdForPrefecture, type RegionId } from '../constants/regions';
import type { Station } from '../types/station';
import type { StationCollectible } from '../types/stationCollectible';

export type PrefectureCollectibleGroup = {
  prefectureKey: string;
  items: StationCollectible[];
};

export type RegionCollectibleSection = {
  regionId: RegionId;
  prefectureGroups: PrefectureCollectibleGroup[];
};

function prefectureOrderInRegion(regionId: RegionId, prefectureKey: string): number {
  const region = REGIONS.find((item) => item.id === regionId);
  if (!region) {
    return Number.MAX_SAFE_INTEGER;
  }

  const index = region.prefectures.indexOf(prefectureKey);
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

function sortCollectiblesByStation(
  items: StationCollectible[],
  stationById: ReadonlyMap<number, Station>,
): StationCollectible[] {
  return [...items].sort((left, right) => {
    const leftStation = stationById.get(left.stationId);
    const rightStation = stationById.get(right.stationId);
    const numberDiff = (leftStation?.number ?? 0) - (rightStation?.number ?? 0);
    if (numberDiff !== 0) {
      return numberDiff;
    }

    return right.createdAt - left.createdAt;
  });
}

export function groupCollectiblesByRegionAndPrefecture(
  items: readonly StationCollectible[],
  stationById: ReadonlyMap<number, Station>,
): RegionCollectibleSection[] {
  const byRegion = new Map<RegionId, Map<string, StationCollectible[]>>();

  for (const item of items) {
    const station = stationById.get(item.stationId);
    if (!station) {
      continue;
    }

    const regionId = getRegionIdForPrefecture(station.prefecture);
    if (!regionId) {
      continue;
    }

    const prefectureKey = getStationLocationFilterKey(station);
    const regionMap = byRegion.get(regionId) ?? new Map<string, StationCollectible[]>();
    const bucket = regionMap.get(prefectureKey) ?? [];
    bucket.push(item);
    regionMap.set(prefectureKey, bucket);
    byRegion.set(regionId, regionMap);
  }

  const sections: RegionCollectibleSection[] = [];

  for (const region of REGIONS) {
    const regionMap = byRegion.get(region.id);
    if (!regionMap) {
      continue;
    }

    const prefectureGroups = [...regionMap.entries()]
      .sort(([left], [right]) => {
        const orderDiff =
          prefectureOrderInRegion(region.id, left) - prefectureOrderInRegion(region.id, right);
        if (orderDiff !== 0) {
          return orderDiff;
        }

        return left.localeCompare(right, 'ja');
      })
      .map(([prefectureKey, groupItems]) => ({
        prefectureKey,
        items: sortCollectiblesByStation(groupItems, stationById),
      }));

    if (prefectureGroups.length > 0) {
      sections.push({
        regionId: region.id,
        prefectureGroups,
      });
    }
  }

  return sections;
}
