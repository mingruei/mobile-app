import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import municipalityBoundaries from '../assets/hokkaido-municipality-boundaries.json';
import { colors } from '../constants/theme';
import { useDynamicTypeLayout } from '../hooks/useDynamicTypeLayout';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useStationProgress } from '../hooks/useStationProgress';
import { useI18n } from '../i18n';
import type { Station } from '../types/station';
import { getMapFocusBounds } from '../utils/mapFocusBounds';
import {
  buildOsmMapHtml,
  buildOsmMapReduceMotionScript,
  buildOsmMapUpdateScript,
  type MunicipalityBoundaries,
} from '../utils/osmMap';

type StationMapProps = {
  stations: Station[];
  focusStations: readonly Station[];
  fitAllHokkaido: boolean;
  onSelectStation: (station: Station) => void;
  compact?: boolean;
};

const MAP_INVALIDATE_SCRIPT =
  '(function(){if(window.__stationMap&&window.__stationMap.invalidateSize){window.__stationMap.invalidateSize();}})();true;';

const boundaries = municipalityBoundaries as MunicipalityBoundaries;

export function StationMap({
  stations,
  focusStations,
  fitAllHokkaido,
  onSelectStation,
  compact = false,
}: StationMapProps) {
  const { t } = useI18n();
  const reduceMotionEnabled = useReduceMotion();
  const { decorativeMaxFontSizeMultiplier } = useDynamicTypeLayout();
  const { progressMap } = useStationProgress();
  const webViewRef = useRef<WebView>(null);
  const onSelectRef = useRef(onSelectStation);
  const html = useMemo(() => buildOsmMapHtml(boundaries), []);
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

  const syncAreas = () => {
    webViewRef.current?.injectJavaScript(
      buildOsmMapUpdateScript(stations, progressMap, focusBounds, fitAllHokkaido),
    );
  };

  const invalidateMapSize = () => {
    webViewRef.current?.injectJavaScript(MAP_INVALIDATE_SCRIPT);
  };

  useEffect(() => {
    syncAreas();
  }, [stations, progressMap, focusBounds, fitAllHokkaido]);

  useEffect(() => {
    webViewRef.current?.injectJavaScript(buildOsmMapReduceMotionScript(reduceMotionEnabled));
    syncAreas();
  }, [reduceMotionEnabled]);

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
      <View style={[styles.attributionBar, compact && styles.attributionBarCompact]}>
        <Text
          maxFontSizeMultiplier={decorativeMaxFontSizeMultiplier}
          style={[styles.attributionText, compact && styles.attributionTextCompact]}
        >
          {t('map.attribution')}
        </Text>
      </View>

      <View
        style={styles.mapArea}
        onLayout={invalidateMapSize}
        accessible
        accessibilityRole="image"
        accessibilityLabel={mapAccessibilityLabel}
        accessibilityHint={t('map.a11yHint')}
      >
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html }}
          style={styles.map}
          importantForAccessibility="no-hide-descendants"
          onLoadEnd={() => {
            webViewRef.current?.injectJavaScript(buildOsmMapReduceMotionScript(reduceMotionEnabled));
            syncAreas();
            invalidateMapSize();
          }}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
        />

        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={t('map.a11yLegend')}
          style={[styles.legend, compact && styles.legendCompact]}
        >
          <View style={styles.legendItem} importantForAccessibility="no-hide-descendants">
            <View style={[styles.legendSwatch, styles.legendSwatchOutline, compact && styles.legendSwatchCompact]} />
            <Text
              maxFontSizeMultiplier={decorativeMaxFontSizeMultiplier}
              style={[styles.legendText, compact && styles.legendTextCompact]}
            >
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
            <Text
              maxFontSizeMultiplier={decorativeMaxFontSizeMultiplier}
              style={[styles.legendText, compact && styles.legendTextCompact]}
            >
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
