import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { colors } from '../constants/theme';
import { useStationProgress } from '../hooks/useStationProgress';
import { useI18n } from '../i18n';
import type { Station } from '../types/station';
import { buildOsmMapHtml, buildOsmMapUpdateScript } from '../utils/osmMap';

type StationMapProps = {
  stations: Station[];
  onSelectStation: (station: Station) => void;
};

export function StationMap({ stations, onSelectStation }: StationMapProps) {
  const { t } = useI18n();
  const { progressMap } = useStationProgress();
  const webViewRef = useRef<WebView>(null);
  const onSelectRef = useRef(onSelectStation);
  const html = useMemo(() => buildOsmMapHtml(), []);

  onSelectRef.current = onSelectStation;

  const syncMarkers = () => {
    webViewRef.current?.injectJavaScript(buildOsmMapUpdateScript(stations, progressMap));
  };

  useEffect(() => {
    syncMarkers();
  }, [stations, progressMap]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { type?: string; id?: number };
      if (data.type !== 'select' || typeof data.id !== 'number') {
        return;
      }

      const station = stations.find((item) => item.id === data.id);
      if (station) {
        onSelectRef.current(station);
      }
    } catch {
      return;
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.map}
        onLoadEnd={syncMarkers}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
      />

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
