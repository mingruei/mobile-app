import type { MunicipalityBoundaries } from './osmMap';
import type { Station } from '../types/station';

export type MapLatLngBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

type GeoJsonPosition = [number, number];

function extendBounds(bounds: MapLatLngBounds, lng: number, lat: number): MapLatLngBounds {
  return {
    south: Math.min(bounds.south, lat),
    north: Math.max(bounds.north, lat),
    west: Math.min(bounds.west, lng),
    east: Math.max(bounds.east, lng),
  };
}

function mergeBounds(left: MapLatLngBounds, right: MapLatLngBounds): MapLatLngBounds {
  return {
    south: Math.min(left.south, right.south),
    north: Math.max(left.north, right.north),
    west: Math.min(left.west, right.west),
    east: Math.max(left.east, right.east),
  };
}

function collectPositions(coordinates: unknown, geometryType: string, output: GeoJsonPosition[]): void {
  if (geometryType === 'Polygon') {
    for (const ring of coordinates as GeoJsonPosition[][]) {
      for (const position of ring) {
        output.push(position);
      }
    }
    return;
  }

  if (geometryType === 'MultiPolygon') {
    for (const polygon of coordinates as GeoJsonPosition[][][]) {
      for (const ring of polygon) {
        for (const position of ring) {
          output.push(position);
        }
      }
    }
  }
}

export function boundsFromGeometry(geometry: {
  type: string;
  coordinates: unknown;
}): MapLatLngBounds | null {
  const positions: GeoJsonPosition[] = [];
  collectPositions(geometry.coordinates, geometry.type, positions);

  if (positions.length === 0) {
    return null;
  }

  return positions.reduce<MapLatLngBounds>(
    (bounds, [lng, lat]) => extendBounds(bounds, lng, lat),
    {
      south: Number.POSITIVE_INFINITY,
      north: Number.NEGATIVE_INFINITY,
      west: Number.POSITIVE_INFINITY,
      east: Number.NEGATIVE_INFINITY,
    },
  );
}

export function getMapFocusBounds(
  stations: readonly Station[],
  boundaries: MunicipalityBoundaries,
): MapLatLngBounds | null {
  if (stations.length === 0) {
    return null;
  }

  const stationIds = new Set(stations.map((station) => station.id));
  let merged: MapLatLngBounds | null = null;

  for (const feature of boundaries.features) {
    if (!stationIds.has(feature.properties.id)) {
      continue;
    }

    const featureBounds = boundsFromGeometry(feature.geometry);
    if (!featureBounds) {
      continue;
    }

    merged = merged ? mergeBounds(merged, featureBounds) : featureBounds;
  }

  return merged;
}
