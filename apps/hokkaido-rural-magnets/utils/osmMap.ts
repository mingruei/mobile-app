import { colors, hokkaidoMapBounds, mapRegion } from '../constants/theme';
import type { Station } from '../types/station';
import type { StationProgressMap } from '../types/stationProgress';
import { getStationDisplayName } from './stationName';
import type { MapLatLngBounds } from './mapFocusBounds';

export type MunicipalityBoundaryProperties = {
  id: number;
  number: number;
  name: string;
  city: string;
};

export type MunicipalityBoundaries = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: MunicipalityBoundaryProperties;
    geometry: {
      type: string;
      coordinates: unknown;
    };
  }>;
};

export type OsmStationArea = {
  id: number;
  name: string;
  visited: boolean;
};

export const municipalityMapStyle = {
  border: colors.original,
  visitedFill: colors.original,
  visitedFillOpacity: 1,
  borderWeight: 1.2,
  visitedBorderWeight: 1.2,
} as const;

export function getStationAreaColor(visited = false): string {
  return municipalityMapStyle.border;
}

export function getMunicipalityPolygonStyle(visited = false): {
  color: string;
  weight: number;
  fillColor: string;
  fillOpacity: number;
} {
  if (visited) {
    return {
      color: municipalityMapStyle.border,
      weight: municipalityMapStyle.visitedBorderWeight,
      fillColor: municipalityMapStyle.visitedFill,
      fillOpacity: municipalityMapStyle.visitedFillOpacity,
    };
  }

  return {
    color: municipalityMapStyle.border,
    weight: municipalityMapStyle.borderWeight,
    fillColor: municipalityMapStyle.border,
    fillOpacity: 0,
  };
}

/** @deprecated Use getStationAreaColor */
export const getStationMarkerColor = getStationAreaColor;

export function toOsmStationAreas(
  stations: readonly Station[],
  progressMap: StationProgressMap = {},
): OsmStationArea[] {
  return stations.map((station) => ({
    id: station.id,
    name: getStationDisplayName(station),
    visited: progressMap[station.id]?.visited ?? false,
  }));
}

/** @deprecated Use toOsmStationAreas */
export const toOsmStationMarkers = toOsmStationAreas;

export type { MapLatLngBounds };

function buildPolygonLayerScript(): string {
  const { border, visitedFill, visitedFillOpacity, borderWeight, visitedBorderWeight } =
    municipalityMapStyle;

  return `
        var mapStyle = {
          border: '${border}',
          visitedFill: '${visitedFill}',
          visitedFillOpacity: ${visitedFillOpacity},
          borderWeight: ${borderWeight},
          visitedBorderWeight: ${visitedBorderWeight},
        };

        function styleForArea(item) {
          if (item.visited) {
            return {
              color: mapStyle.border,
              weight: mapStyle.visitedBorderWeight,
              fillColor: mapStyle.visitedFill,
              fillOpacity: mapStyle.visitedFillOpacity,
            };
          }

          return {
            color: mapStyle.border,
            weight: mapStyle.borderWeight,
            fillColor: mapStyle.border,
            fillOpacity: 0,
          };
        }

        window.__reduceMotion = false;

        function fitMapToFocus(focusBounds, fitAllHokkaido) {
          var target = bounds;
          if (!fitAllHokkaido && focusBounds) {
            target = L.latLngBounds(
              L.latLng(focusBounds.south, focusBounds.west),
              L.latLng(focusBounds.north, focusBounds.east),
            );
          }

          map.fitBounds(target, {
            paddingTopLeft: [12, 12],
            paddingBottomRight: [12, 8],
            maxZoom: fitAllHokkaido || !focusBounds ? 7 : 10,
            animate: !window.__reduceMotion,
          });
        }

        function renderAreas(items, focusBounds, fitAllHokkaido) {
          layer.clearLayers();

          if (items.length) {
            var visibleIds = {};
            items.forEach(function (item) {
              visibleIds[item.id] = item;
            });

            L.geoJSON(boundaries, {
              filter: function (feature) {
                return visibleIds[feature.properties.id] != null;
              },
              style: function (feature) {
                var item = visibleIds[feature.properties.id];
                return styleForArea(item);
              },
              onEachFeature: function (feature, polygonLayer) {
                var item = visibleIds[feature.properties.id];
                polygonLayer.bindTooltip(item.name, {
                  sticky: true,
                  direction: 'center',
                });
                polygonLayer.on('click', function () {
                  postSelect(item.id);
                });
              },
            }).addTo(layer);
          }

          fitMapToFocus(focusBounds, fitAllHokkaido);
        }`;
}

export function buildOsmMapHtml(boundaries: MunicipalityBoundaries): string {
  const boundariesJson = JSON.stringify(boundaries);

  return `<!DOCTYPE html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1"
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
      .leaflet-tooltip.municipality-tooltip {
        font-size: 12px;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      (function () {
        var boundaries = ${boundariesJson};
        var bounds = L.latLngBounds(
          L.latLng(${hokkaidoMapBounds.south}, ${hokkaidoMapBounds.west}),
          L.latLng(${hokkaidoMapBounds.north}, ${hokkaidoMapBounds.east}),
        );

        var map = L.map('map', {
          center: [${mapRegion.latitude}, ${mapRegion.longitude}],
          zoom: 7,
          minZoom: 6,
          maxZoom: 14,
          maxBounds: bounds,
          maxBoundsViscosity: 1.0,
          scrollWheelZoom: true,
          attributionControl: false,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
        }).addTo(map);

        var layer = L.layerGroup().addTo(map);
        ${buildPolygonLayerScript()}

        function postSelect(id) {
          var payload = JSON.stringify({ type: 'select', id: id });
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(payload);
          } else if (window.parent) {
            window.parent.postMessage(payload, '*');
          }
        }

        window.__stationMap = {
          updateAreas: renderAreas,
          updateMarkers: renderAreas,
          invalidateSize: function () {
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

export function buildOsmMapReduceMotionScript(reduceMotion: boolean): string {
  return `(function(){window.__reduceMotion=${reduceMotion ? 'true' : 'false'};})();true;`;
}

export function buildOsmMapUpdateScript(
  stations: readonly Station[],
  progressMap: StationProgressMap = {},
  focusBounds: MapLatLngBounds | null = null,
  fitAllHokkaido = false,
): string {
  const areas = JSON.stringify(toOsmStationAreas(stations, progressMap));
  const boundsJson = focusBounds ? JSON.stringify(focusBounds) : 'null';
  const fitAll = fitAllHokkaido ? 'true' : 'false';
  return `(function(){if(window.__stationMap){window.__stationMap.updateAreas(${areas}, ${boundsJson}, ${fitAll});}})();true;`;
}
