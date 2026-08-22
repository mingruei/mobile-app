import { colors } from '../../constants/theme';
import {
  buildOsmMapHtml,
  buildOsmMapUpdateScript,
  getStationMarkerColor,
  toOsmStationMarkers,
} from '../osmMap';
import { createStation, createProgressEntry } from './fixtures';

describe('osmMap', () => {
  it('returns marker colors by visited state', () => {
    expect(getStationMarkerColor(false)).toBe(colors.original);
    expect(getStationMarkerColor(true)).toBe(colors.visitedMarker);
  });

  it('maps stations to OSM markers', () => {
    const stations = [
      createStation({ id: 1, latitude: 35, longitude: 135 }),
      createStation({ id: 2, latitude: 36, longitude: 136 }),
    ];
    const progressMap = {
      1: createProgressEntry({ visited: true }),
    };

    expect(toOsmStationMarkers(stations, progressMap)).toEqual([
      {
        id: 1,
        lat: 35,
        lng: 135,
        name: stations[0]?.name,
        color: colors.visitedMarker,
      },
      {
        id: 2,
        lat: 36,
        lng: 136,
        name: stations[1]?.name,
        color: colors.original,
      },
    ]);
  });

  it('builds HTML with map bootstrap script', () => {
    const html = buildOsmMapHtml();
    expect(html).toContain('<div id="map"></div>');
    expect(html).toContain('window.__stationMap');
    expect(html).toContain('leaflet');
  });

  it('builds marker update script for webview injection', () => {
    const stations = [createStation({ id: 1, latitude: 35, longitude: 135 })];
    const script = buildOsmMapUpdateScript(stations, {});

    expect(script).toContain('window.__stationMap.updateMarkers');
    expect(script).toContain('"id":1');
    expect(script.endsWith('true;')).toBe(true);
  });
});
