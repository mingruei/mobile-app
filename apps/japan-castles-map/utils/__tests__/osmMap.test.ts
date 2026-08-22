import { colors } from '../../constants/theme';
import {
  buildOsmMapHtml,
  buildOsmMapUpdateScript,
  getCastleMarkerColor,
  toOsmCastleMarkers,
} from '../osmMap';
import { createCastle, createProgressEntry } from './fixtures';

describe('osmMap', () => {
  it('returns marker colors by series and visited state', () => {
    expect(getCastleMarkerColor('original', false)).toBe(colors.original);
    expect(getCastleMarkerColor('continued', false)).toBe(colors.continued);
    expect(getCastleMarkerColor('original', true)).toBe(colors.visitedMarker);
  });

  it('maps castles to OSM markers', () => {
    const castles = [
      createCastle({ id: 1, series: 'original', latitude: 35, longitude: 135 }),
      createCastle({ id: 2, series: 'continued', latitude: 36, longitude: 136 }),
    ];
    const progressMap = {
      1: createProgressEntry({ visited: true }),
    };

    expect(toOsmCastleMarkers(castles, progressMap)).toEqual([
      {
        id: 1,
        lat: 35,
        lng: 135,
        name: castles[0]?.name,
        color: colors.visitedMarker,
      },
      {
        id: 2,
        lat: 36,
        lng: 136,
        name: castles[1]?.name,
        color: colors.continued,
      },
    ]);
  });

  it('builds HTML with map bootstrap script', () => {
    const html = buildOsmMapHtml();
    expect(html).toContain('<div id="map"></div>');
    expect(html).toContain('window.__castleMap');
    expect(html).toContain('leaflet');
  });

  it('builds marker update script for webview injection', () => {
    const castles = [createCastle({ id: 1, latitude: 35, longitude: 135 })];
    const script = buildOsmMapUpdateScript(castles, {});

    expect(script).toContain('window.__castleMap.updateMarkers');
    expect(script).toContain('"id":1');
    expect(script.endsWith('true;')).toBe(true);
  });
});
