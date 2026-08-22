import { colors } from '../../constants/theme';
import municipalityBoundaries from '../../assets/hokkaido-municipality-boundaries.json';
import {
  buildOsmMapHtml,
  buildOsmMapReduceMotionScript,
  buildOsmMapUpdateScript,
  getMunicipalityPolygonStyle,
  getStationAreaColor,
  toOsmStationAreas,
  type MunicipalityBoundaries,
} from '../osmMap';
import { createStation, createProgressEntry } from './fixtures';

const boundaries = municipalityBoundaries as MunicipalityBoundaries;

describe('osmMap', () => {
  it('returns legend colors by visited state', () => {
    expect(getStationAreaColor(false)).toBe(colors.original);
    expect(getStationAreaColor(true)).toBe(colors.original);
  });

  it('uses outline-only styling for unvisited municipalities', () => {
    expect(getMunicipalityPolygonStyle(false)).toEqual({
      color: colors.original,
      weight: 1.2,
      fillColor: colors.original,
      fillOpacity: 0,
    });
  });

  it('fills visited municipalities', () => {
    expect(getMunicipalityPolygonStyle(true)).toEqual({
      color: colors.original,
      weight: 1.2,
      fillColor: colors.original,
      fillOpacity: 1,
    });
  });

  it('builds reduce motion script for embedded map', () => {
    expect(buildOsmMapReduceMotionScript(true)).toContain('window.__reduceMotion=true');
    expect(buildOsmMapReduceMotionScript(false)).toContain('window.__reduceMotion=false');
  });

  it('maps stations to OSM area styles', () => {
    const stations = [
      createStation({ id: 1, name: '旭川市' }),
      createStation({ id: 2, name: '美瑛町' }),
    ];
    const progressMap = {
      1: createProgressEntry({ visited: true }),
    };

    expect(toOsmStationAreas(stations, progressMap)).toEqual([
      {
        id: 1,
        name: '旭川市',
        visited: true,
      },
      {
        id: 2,
        name: '美瑛町',
        visited: false,
      },
    ]);
  });

  it('builds HTML with municipality boundaries and Hokkaido map bounds', () => {
    const html = buildOsmMapHtml(boundaries);
    expect(html).toContain('<div id="map"></div>');
    expect(html).toContain('window.__stationMap');
    expect(html).toContain('updateAreas');
    expect(html).toContain('fitMapToFocus');
    expect(html).toContain('styleForArea');
    expect(html).toContain('fillOpacity: 0');
    expect(html).toContain('maxBounds');
    expect(html).toContain('attributionControl: false');
    expect(html).toContain('leaflet');
    expect(html).toContain('旭川市');
    expect(html).toContain('invalidateSize');
  });

  it('builds area update script for webview injection', () => {
    const stations = [createStation({ id: 1, name: '旭川市' })];
    const script = buildOsmMapUpdateScript(stations, {}, {
      south: 42,
      west: 140,
      north: 44,
      east: 143,
    });

    expect(script).toContain('window.__stationMap.updateAreas');
    expect(script).toContain('"id":1');
    expect(script).toContain('"visited":false');
    expect(script).toContain('"south":42');
    expect(script).toContain('false);');
    expect(script.endsWith('true;')).toBe(true);
  });

  it('fits full Hokkaido when fitAllHokkaido is true', () => {
    const stations = [createStation({ id: 1, name: '旭川市' })];
    const script = buildOsmMapUpdateScript(stations, {}, null, true);

    expect(script).toContain('null, true');
  });
});

describe('hokkaido-municipality-boundaries.json', () => {
  it('contains 179 municipality polygons aligned with station ids', () => {
    expect(boundaries.type).toBe('FeatureCollection');
    expect(boundaries.features).toHaveLength(179);

    const sapporo = boundaries.features.filter((feature) => feature.properties.city === '札幌市');
    expect(sapporo).toHaveLength(1);
    expect(sapporo[0]?.geometry.type).toBe('MultiPolygon');
  });
});
