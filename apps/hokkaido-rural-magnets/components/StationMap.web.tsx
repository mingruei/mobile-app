import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View, type View as ViewType } from 'react-native';
import L from 'leaflet';

import municipalityBoundaries from '../assets/hokkaido-municipality-boundaries.json';
import { colors, hokkaidoMapBounds, mapRegion } from '../constants/theme';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useStationProgress } from '../hooks/useStationProgress';
import { useI18n } from '../i18n';
import type { Station } from '../types/station';
import { getMapFocusBounds } from '../utils/mapFocusBounds';
import {
  getMunicipalityPolygonStyle,
  toOsmStationAreas,
  type MapLatLngBounds,
  type MunicipalityBoundaries,
  type MunicipalityBoundaryProperties,
  type OsmStationArea,
} from '../utils/osmMap';

type StationMapProps = {
  stations: Station[];
  focusStations: readonly Station[];
  fitAllHokkaido: boolean;
  onSelectStation: (station: Station) => void;
  compact?: boolean;
};

const boundaries = municipalityBoundaries as MunicipalityBoundaries;

function fitMapToFocus(
  map: L.Map,
  focusBounds: MapLatLngBounds | null,
  fitAllHokkaido: boolean,
  animate: boolean,
): void {
  const fullBounds = L.latLngBounds(
    [hokkaidoMapBounds.south, hokkaidoMapBounds.west],
    [hokkaidoMapBounds.north, hokkaidoMapBounds.east],
  );

  const target =
    fitAllHokkaido || !focusBounds
      ? fullBounds
      : L.latLngBounds(
          [focusBounds.south, focusBounds.west],
          [focusBounds.north, focusBounds.east],
        );

  map.fitBounds(target, {
    paddingTopLeft: [12, 12],
    paddingBottomRight: [12, 8],
    maxZoom: fitAllHokkaido || !focusBounds ? 7 : 10,
    animate,
  });
}

function renderOsmStationAreas(
  layer: L.LayerGroup,
  areas: readonly OsmStationArea[],
  onSelect: (id: number) => void,
): void {
  layer.clearLayers();

  if (areas.length === 0) {
    return;
  }

  const visibleIds = new Map(areas.map((area) => [area.id, area]));

  L.geoJSON(boundaries, {
    filter: (feature) =>
      visibleIds.has((feature.properties as MunicipalityBoundaryProperties).id),
    style: (feature) => {
      if (!feature) {
        return getMunicipalityPolygonStyle(false);
      }

      const item = visibleIds.get((feature.properties as MunicipalityBoundaryProperties).id);
      return getMunicipalityPolygonStyle(item?.visited ?? false);
    },
    onEachFeature: (feature, polygonLayer) => {
      const item = visibleIds.get((feature.properties as MunicipalityBoundaryProperties).id);
      if (!item) {
        return;
      }

      polygonLayer.bindTooltip(item.name, {
        sticky: true,
        direction: 'center',
      });
      polygonLayer.on('click', () => onSelect(item.id));
    },
  }).addTo(layer);
}

export function StationMap({
  stations,
  focusStations,
  fitAllHokkaido,
  onSelectStation,
  compact = false,
}: StationMapProps) {
  const { t } = useI18n();
  const reduceMotionEnabled = useReduceMotion();
  const { progressMap } = useStationProgress();
  const mapHostRef = useRef<ViewType>(null);
  const mapRef = useRef<L.Map | null>(null);
  const areasLayerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelectStation);
  const focusBounds = useMemo(
    () => (fitAllHokkaido ? null : getMapFocusBounds(focusStations, boundaries)),
    [fitAllHokkaido, focusStations],
  );
  const visitedCount = useMemo(
    () => stations.filter((station) => progressMap[station.id]?.visited).length,
    [progressMap, stations],
  );
  const mapAccessibilityLabel = t('map.a11ySummary', {
    count: stations.length,
    visited: visitedCount,
  });

  onSelectRef.current = onSelectStation;

  useEffect(() => {
    const linkId = 'leaflet-stylesheet';
    if (typeof document !== 'undefined' && !document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    const host = mapHostRef.current as unknown as HTMLElement | null;
    if (!host || mapRef.current) {
      return;
    }

    const bounds = L.latLngBounds(
      [hokkaidoMapBounds.south, hokkaidoMapBounds.west],
      [hokkaidoMapBounds.north, hokkaidoMapBounds.east],
    );

    const map = L.map(host, {
      center: [mapRegion.latitude, mapRegion.longitude],
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

    areasLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    fitMapToFocus(map, null, true, !reduceMotionEnabled);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(host);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      areasLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = areasLayerRef.current;
    if (!layer) {
      return;
    }

    const areas = toOsmStationAreas(stations, progressMap);
    renderOsmStationAreas(layer, areas, (id) => {
      const station = stations.find((item) => item.id === id);
      if (station) {
        onSelectRef.current(station);
      }
    });
  }, [stations, progressMap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    fitMapToFocus(map, focusBounds, fitAllHokkaido, !reduceMotionEnabled);
  }, [focusBounds, fitAllHokkaido, reduceMotionEnabled]);

  return (
    <View style={styles.container}>
      <View style={[styles.attributionBar, compact && styles.attributionBarCompact]}>
        <Text style={[styles.attributionText, compact && styles.attributionTextCompact]}>
          {t('map.attribution')}
        </Text>
      </View>

      <View
        style={styles.mapArea}
        accessible
        accessibilityRole="image"
        accessibilityLabel={mapAccessibilityLabel}
        accessibilityHint={t('map.a11yHint')}
      >
        <View ref={mapHostRef} style={styles.map} collapsable={false} importantForAccessibility="no" />

        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={t('map.a11yLegend')}
          style={[styles.legend, compact && styles.legendCompact]}
        >
          <View style={styles.legendItem} importantForAccessibility="no-hide-descendants">
            <View style={[styles.legendSwatch, styles.legendSwatchOutline, compact && styles.legendSwatchCompact]} />
            <Text style={[styles.legendText, compact && styles.legendTextCompact]}>
              {t('map.notVisited')}
            </Text>
          </View>
          <View style={styles.legendItem} importantForAccessibility="no-hide-descendants">
            <View
              style={[
                styles.legendSwatch,
                compact && styles.legendSwatchCompact,
                styles.legendSwatchFilled,
              ]}
            />
            <Text style={[styles.legendText, compact && styles.legendTextCompact]}>
              {t('station.visited')}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  attributionBar: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  attributionBarCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mapArea: {
    flex: 1,
    minHeight: 0,
  },
  map: {
    flex: 1,
    minHeight: 0,
  },
  attributionText: {
    fontSize: 11,
    lineHeight: 15,
    color: colors.textMuted,
  },
  attributionTextCompact: {
    fontSize: 10,
    lineHeight: 14,
  },
  legend: {
    position: 'absolute',
    top: 8,
    right: 8,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  legendCompact: {
    top: 6,
    right: 6,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendSwatch: {
    width: 14,
    height: 14,
    borderRadius: 3,
    opacity: 0.85,
  },
  legendSwatchCompact: {
    width: 10,
    height: 10,
  },
  legendSwatchOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.original,
  },
  legendSwatchFilled: {
    backgroundColor: colors.original,
    borderWidth: 1.5,
    borderColor: colors.original,
    opacity: 0.85,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  legendTextCompact: {
    fontSize: 11,
  },
});
