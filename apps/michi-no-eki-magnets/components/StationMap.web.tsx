import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, type View as ViewType } from 'react-native';
import L from 'leaflet';

import { colors, mapRegion } from '../constants/theme';
import { useStationProgress } from '../hooks/useStationProgress';
import { useI18n } from '../i18n';
import type { Station } from '../types/station';
import { getStationMarkerColor } from '../utils/osmMap';

type StationMapProps = {
  stations: Station[];
  onSelectStation: (station: Station) => void;
};

export function StationMap({ stations, onSelectStation }: StationMapProps) {
  const { t } = useI18n();
  const { progressMap } = useStationProgress();
  const mapHostRef = useRef<ViewType>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelectStation);

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

    const map = L.map(host, {
      center: [mapRegion.latitude, mapRegion.longitude],
      zoom: 6,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(host);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = markersLayerRef.current;
    if (!layer) {
      return;
    }

    layer.clearLayers();

    for (const station of stations) {
      const visited = progressMap[station.id]?.visited ?? false;
      const markerColor = getStationMarkerColor(visited);
      const marker = L.circleMarker([station.latitude, station.longitude], {
        radius: 7,
        color: markerColor,
        fillColor: markerColor,
        fillOpacity: 0.95,
        weight: 2,
      });

      marker.bindTooltip(station.name, { direction: 'top', offset: [0, -4] });
      marker.on('click', () => onSelectRef.current(station));
      marker.addTo(layer);
    }
  }, [stations, progressMap]);

  return (
    <View style={styles.container}>
      <View ref={mapHostRef} style={styles.map} collapsable={false} />

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.original }]} />
          <Text style={styles.legendText}>{t('map.notVisited')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.visitedMarker }]} />
          <Text style={styles.legendText}>{t('station.visited')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
    minHeight: 200,
  },
  legend: {
    position: 'absolute',
    top: 16,
    right: 16,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
});
