import { colors, mapRegion } from '../constants/theme';
import type { Castle } from '../types/castle';
import type { CastleProgressMap } from '../types/castleProgress';

export type OsmCastleMarker = {
  id: number;
  lat: number;
  lng: number;
  name: string;
  color: string;
};

export function getCastleMarkerColor(series: Castle['series'], visited = false): string {
  if (visited) {
    return colors.visitedMarker;
  }

  return series === 'original' ? colors.original : colors.continued;
}

export function toOsmCastleMarkers(
  castles: readonly Castle[],
  progressMap: CastleProgressMap = {},
): OsmCastleMarker[] {
  return castles.map((castle) => ({
    id: castle.id,
    lat: castle.latitude,
    lng: castle.longitude,
    name: castle.name,
    color: getCastleMarkerColor(castle.series, progressMap[castle.id]?.visited ?? false),
  }));
}

export function buildOsmMapHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <style>
      html, body, #map { height: 100%; margin: 0; padding: 0; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      (function () {
        var map = L.map('map', {
          center: [${mapRegion.latitude}, ${mapRegion.longitude}],
          zoom: 6,
          scrollWheelZoom: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        var layer = L.layerGroup().addTo(map);

        function postSelect(id) {
          var payload = JSON.stringify({ type: 'select', id: id });
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(payload);
          } else if (window.parent) {
            window.parent.postMessage(payload, '*');
          }
        }

        window.__castleMap = {
          updateMarkers: function (items) {
            layer.clearLayers();
            items.forEach(function (item) {
              var marker = L.circleMarker([item.lat, item.lng], {
                radius: 7,
                color: item.color,
                fillColor: item.color,
                fillOpacity: 0.95,
                weight: 2,
              });
              marker.bindTooltip(item.name, { direction: 'top', offset: [0, -4] });
              marker.on('click', function () {
                postSelect(item.id);
              });
              marker.addTo(layer);
            });
            setTimeout(function () {
              map.invalidateSize();
            }, 0);
          },
        };
      })();
    </script>
  </body>
</html>`;
}

export function buildOsmMapUpdateScript(
  castles: readonly Castle[],
  progressMap: CastleProgressMap = {},
): string {
  const markers = JSON.stringify(toOsmCastleMarkers(castles, progressMap));
  return `(function(){if(window.__castleMap){window.__castleMap.updateMarkers(${markers});}})();true;`;
}
