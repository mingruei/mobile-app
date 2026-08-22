import municipalityBoundaries from '../../assets/hokkaido-municipality-boundaries.json';
import { createStation } from './fixtures';
import {
  boundsFromGeometry,
  getMapFocusBounds,
  type MapLatLngBounds,
} from '../mapFocusBounds';
import type { MunicipalityBoundaries } from '../osmMap';

const boundaries = municipalityBoundaries as MunicipalityBoundaries;

describe('mapFocusBounds', () => {
  it('derives bounds from polygon geometry', () => {
    const feature = boundaries.features[0];
    const bounds = boundsFromGeometry(feature.geometry);

    expect(bounds).not.toBeNull();
    expect(bounds!.south).toBeLessThan(bounds!.north);
    expect(bounds!.west).toBeLessThan(bounds!.east);
  });

  it('merges bounds for selected sub-area stations', () => {
    const stations = boundaries.features
      .slice(0, 3)
      .map((feature) => createStation({ id: feature.properties.id, name: feature.properties.name }));

    const bounds = getMapFocusBounds(stations, boundaries);

    expect(bounds).not.toBeNull();
    expect(bounds!.south).toBeLessThan(bounds!.north);
    expect(bounds!.west).toBeLessThan(bounds!.east);
  });

  it('returns null when no stations are provided', () => {
    expect(getMapFocusBounds([], boundaries)).toBeNull();
  });

  it('returns null when stations do not match boundary features', () => {
    const stations = [createStation({ id: 999999, name: '不存在' })];
    expect(getMapFocusBounds(stations, boundaries)).toBeNull();
  });
});

describe('MapLatLngBounds shape', () => {
  it('accepts south/west/north/east coordinates', () => {
    const bounds: MapLatLngBounds = {
      south: 41.35,
      west: 139.33,
      north: 45.55,
      east: 145.85,
    };

    expect(bounds.north).toBeGreaterThan(bounds.south);
    expect(bounds.east).toBeGreaterThan(bounds.west);
  });
});
