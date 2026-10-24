import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CheckOption } from '../components/CheckOption';
import { PlaceSearchField } from '../components/PlaceSearchField';
import { colors } from '../constants/theme';
import { useMapProvider } from '../hooks/useMapProvider';
import { useStationData } from '../hooks/useStationData';
import { useStationProgress } from '../hooks/useStationProgress';
import { useI18n } from '../i18n';
import {
  createCurrentLocationPlace,
  isCurrentLocationPlace,
  type SelectedPlace,
} from '../types/selectedPlace';
import type { Station } from '../types/station';
import { getCurrentLocationInJapan } from '../utils/localPrefecture';
import { openMapsDrivingRoute } from '../utils/maps';
import {
  clampCorridorKm,
  CORRIDOR_STEP_KM,
  corridorKmToMeters,
  DEFAULT_CORRIDOR_KM,
  filterStationsForRoutePlan,
  isRoutePlanStationExcluded,
  MAX_CORRIDOR_KM,
  MAX_MAP_WAYPOINT_COUNT,
  MIN_CORRIDOR_KM,
  pickWaypointStations,
  planDrivingRouteStations,
  roadAvoidKeysToOptions,
  ROUTE_PLAN_EXCLUDE_KEYS,
  ROUTE_PLAN_ROAD_AVOID_KEYS,
  type RoutePlanExcludeKey,
  type RoutePlanRoadAvoidKey,
  type RoutePlanSource,
} from '../utils/routePlan';

type RoutePlanScreenProps = {
  onBack: () => void;
};

const EXCLUDE_LABEL_KEYS: Record<RoutePlanExcludeKey, 'routePlan.excludeVisited' | 'routePlan.excludeHasMagnet' | 'routePlan.excludeMagnetNotSold'> =
  {
    visited: 'routePlan.excludeVisited',
    magnet: 'routePlan.excludeHasMagnet',
    magnetNotSold: 'routePlan.excludeMagnetNotSold',
  };

const ROAD_AVOID_LABEL_KEYS: Record<RoutePlanRoadAvoidKey, 'routePlan.excludeHighways' | 'routePlan.excludeTolls'> =
  {
    highways: 'routePlan.excludeHighways',
    tolls: 'routePlan.excludeTolls',
  };

function PlannedStationRow({
  station,
  excluded,
  included,
  onToggleIncluded,
}: {
  station: Station;
  excluded: boolean;
  included: boolean;
  onToggleIncluded: () => void;
}) {
  const { t } = useI18n();

  return (
    <View style={[styles.plannedRow, excluded && styles.plannedRowFilteredOut]}>
      <Text style={[styles.stationRow, excluded && styles.stationRowExcluded]} numberOfLines={2}>
        {station.name}
      </Text>
      <View style={styles.includeToggle}>
        <CheckOption
          label={t('routePlan.includeInRoute')}
          checked={!excluded && included}
          disabled={excluded}
          onToggle={onToggleIncluded}
        />
      </View>
    </View>
  );
}

export function RoutePlanScreen({ onBack }: RoutePlanScreenProps) {
  const { t } = useI18n();
  const { stations } = useStationData();
  const { getProgress, progressMap } = useStationProgress();
  const { mapProvider } = useMapProvider();
  const [origin, setOrigin] = useState<SelectedPlace | null>(null);
  const [destination, setDestination] = useState<SelectedPlace | null>(null);
  const [isResolvingOrigin, setIsResolvingOrigin] = useState(true);
  const [originLocationError, setOriginLocationError] = useState<string | null>(null);
  const originRef = useRef<SelectedPlace | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [plannedStations, setPlannedStations] = useState<Station[] | null>(null);
  const [includedStationIds, setIncludedStationIds] = useState<ReadonlySet<number>>(() => new Set());
  const [corridorKm, setCorridorKm] = useState(DEFAULT_CORRIDOR_KM);
  const [routeSource, setRouteSource] = useState<RoutePlanSource | null>(null);
  const [excludeOptions, setExcludeOptions] = useState<ReadonlySet<RoutePlanExcludeKey>>(
    () => new Set(),
  );
  const [roadAvoidOptions, setRoadAvoidOptions] = useState<ReadonlySet<RoutePlanRoadAvoidKey>>(
    () => new Set(),
  );
  const roadAvoid = useMemo(
    () => roadAvoidKeysToOptions(roadAvoidOptions),
    [roadAvoidOptions],
  );
  const canPlanRoute = origin != null && destination != null;

  useEffect(() => {
    originRef.current = origin;
  }, [origin]);

  const clearPlanResults = useCallback(() => {
    setPlannedStations(null);
    setIncludedStationIds(new Set());
    setRouteSource(null);
  }, []);

  const applyCurrentLocationAsOrigin = useCallback(async () => {
    setIsResolvingOrigin(true);
    setOriginLocationError(null);
    try {
      const coords = await getCurrentLocationInJapan();
      if (!coords) {
        setOriginLocationError(t('routePlan.originCurrentLocationUnavailable'));
        return null;
      }

      const place = createCurrentLocationPlace(
        coords.latitude,
        coords.longitude,
        t('routePlan.originCurrentLocation'),
      );
      setOrigin(place);
      clearPlanResults();
      return place;
    } finally {
      setIsResolvingOrigin(false);
    }
  }, [clearPlanResults, t]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsResolvingOrigin(true);
      setOriginLocationError(null);
      try {
        const coords = await getCurrentLocationInJapan();
        if (cancelled || originRef.current != null) {
          return;
        }
        if (!coords) {
          setOriginLocationError(t('routePlan.originCurrentLocationUnavailable'));
          return;
        }
        setOrigin(
          createCurrentLocationPlace(
            coords.latitude,
            coords.longitude,
            t('routePlan.originCurrentLocation'),
          ),
        );
      } finally {
        if (!cancelled) {
          setIsResolvingOrigin(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [t]);

  const eligiblePlannedStations = useMemo(() => {
    if (!plannedStations) {
      return null;
    }
    return filterStationsForRoutePlan(plannedStations, excludeOptions, getProgress);
  }, [excludeOptions, getProgress, plannedStations, progressMap]);

  const includedStations = useMemo(() => {
    if (!eligiblePlannedStations) {
      return [];
    }
    return eligiblePlannedStations.filter((station) => includedStationIds.has(station.id));
  }, [eligiblePlannedStations, includedStationIds]);

  useEffect(() => {
    if (!eligiblePlannedStations) {
      return;
    }

    setIncludedStationIds((current) => {
      const allowed = new Set(eligiblePlannedStations.map((station) => station.id));
      const remaining = [...current].filter((id) => allowed.has(id));
      if (remaining.length > 0) {
        return new Set(remaining);
      }
      if (eligiblePlannedStations.length === 0) {
        return new Set();
      }
      return new Set(
        pickWaypointStations(eligiblePlannedStations, MAX_MAP_WAYPOINT_COUNT).map(
          (station) => station.id,
        ),
      );
    });
  }, [eligiblePlannedStations]);

  const mapsWaypointCount = useMemo(
    () => pickWaypointStations(includedStations, MAX_MAP_WAYPOINT_COUNT).length,
    [includedStations],
  );

  const adjustCorridorKm = (delta: number) => {
    setCorridorKm((current) => clampCorridorKm(current + delta));
    clearPlanResults();
  };

  const toggleExcludeOption = useCallback((key: RoutePlanExcludeKey) => {
    setExcludeOptions((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const toggleRoadAvoidOption = useCallback((key: RoutePlanRoadAvoidKey) => {
    setRoadAvoidOptions((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    clearPlanResults();
  }, []);

  const handlePlanRoute = useCallback(async () => {
    if (!origin || !destination) {
      return;
    }

    setIsPlanning(true);
    try {
      const planned = await planDrivingRouteStations(stations, origin, destination, {
        corridorMeters: corridorKmToMeters(corridorKm),
        roadAvoid,
      });
      setRouteSource(planned.source);
      setPlannedStations(planned.result.stations);
    } finally {
      setIsPlanning(false);
    }
  }, [corridorKm, destination, origin, roadAvoid, stations]);

  const toggleStationIncluded = useCallback((stationId: number) => {
    if (isRoutePlanStationExcluded(stationId, excludeOptions, getProgress)) {
      return;
    }

    setIncludedStationIds((current) => {
      const next = new Set(current);
      if (next.has(stationId)) {
        next.delete(stationId);
      } else {
        next.add(stationId);
      }
      return next;
    });
  }, [excludeOptions, getProgress]);

  const handleOpenMaps = useCallback(async () => {
    if (!origin || !destination || includedStations.length === 0) {
      return;
    }

    const waypoints = pickWaypointStations(includedStations, MAX_MAP_WAYPOINT_COUNT);

    await openMapsDrivingRoute(
      mapProvider,
      {
        latitude: origin.latitude,
        longitude: origin.longitude,
        placeId: isCurrentLocationPlace(origin) ? undefined : origin.placeId,
        useDeviceLocation: isCurrentLocationPlace(origin),
      },
      {
        latitude: destination.latitude,
        longitude: destination.longitude,
        label: destination.label,
      },
      waypoints.map((station) => ({
        latitude: station.latitude,
        longitude: station.longitude,
        label: station.name,
      })),
      roadAvoid,
    );
  }, [destination, includedStations, mapProvider, origin, roadAvoid]);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backLabel}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.topBarTitle}>{t('routePlan.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>{t('routePlan.intro')}</Text>

        <View style={styles.originSection}>
          <PlaceSearchField
            label={t('routePlan.originLabel')}
            placeholder={t('routePlan.originPlaceholder')}
            value={origin}
            onChange={(place) => {
              setOrigin(place);
              setOriginLocationError(null);
              clearPlanResults();
            }}
          />
          {isResolvingOrigin ? (
            <Text style={styles.hint}>{t('routePlan.originCurrentLocationLoading')}</Text>
          ) : null}
          {originLocationError ? <Text style={styles.warning}>{originLocationError}</Text> : null}
          {!isCurrentLocationPlace(origin) ? (
            <Pressable
              accessibilityRole="button"
              disabled={isResolvingOrigin}
              onPress={() => void applyCurrentLocationAsOrigin()}
              style={[styles.useLocationButton, isResolvingOrigin && styles.useLocationButtonDisabled]}
            >
              <Text style={styles.useLocationButtonLabel}>{t('routePlan.useCurrentLocation')}</Text>
            </Pressable>
          ) : null}
        </View>

        <PlaceSearchField
          label={t('routePlan.destinationLabel')}
          placeholder={t('routePlan.destinationPlaceholder')}
          value={destination}
          onChange={(place) => {
            setDestination(place);
            clearPlanResults();
          }}
        />

        <View style={styles.corridorSection}>
          <Text style={styles.fieldLabel}>{t('routePlan.corridorLabel')}</Text>
          <View style={styles.stepperRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="減少公里數"
              disabled={corridorKm <= MIN_CORRIDOR_KM}
              onPress={() => adjustCorridorKm(-CORRIDOR_STEP_KM)}
              style={[styles.stepperButton, corridorKm <= MIN_CORRIDOR_KM && styles.stepperButtonDisabled]}
            >
              <Text style={styles.stepperButtonLabel}>−</Text>
            </Pressable>
            <Text style={styles.stepperValue}>{t('routePlan.corridorValue', { km: corridorKm })}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="增加公里數"
              disabled={corridorKm >= MAX_CORRIDOR_KM}
              onPress={() => adjustCorridorKm(CORRIDOR_STEP_KM)}
              style={[styles.stepperButton, corridorKm >= MAX_CORRIDOR_KM && styles.stepperButtonDisabled]}
            >
              <Text style={styles.stepperButtonLabel}>＋</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>{t('routePlan.corridorHint')}</Text>
        </View>

        <View style={styles.corridorSection}>
          <Text style={styles.fieldLabel}>{t('routePlan.excludeLabel')}</Text>
          {ROUTE_PLAN_EXCLUDE_KEYS.map((key) => (
            <CheckOption
              key={key}
              label={t(EXCLUDE_LABEL_KEYS[key])}
              checked={excludeOptions.has(key)}
              onToggle={() => toggleExcludeOption(key)}
            />
          ))}
          {ROUTE_PLAN_ROAD_AVOID_KEYS.map((key) => (
            <CheckOption
              key={key}
              label={t(ROAD_AVOID_LABEL_KEYS[key])}
              checked={roadAvoidOptions.has(key)}
              onToggle={() => toggleRoadAvoidOption(key)}
            />
          ))}
          <Text style={styles.hint}>{t('routePlan.routeAvoidHint')}</Text>
        </View>

        {canPlanRoute ? (
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>{t('routePlan.selectedTitle')}</Text>
            <Text style={styles.summaryBody}>
              {t('routePlan.selectedOrigin', { label: origin!.label })}
            </Text>
            <Text style={styles.summaryBody}>
              {t('routePlan.selectedDestination', { label: destination!.label })}
            </Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={!canPlanRoute || isPlanning}
          style={[styles.planButton, (!canPlanRoute || isPlanning) && styles.planButtonDisabled]}
          onPress={() => void handlePlanRoute()}
        >
          {isPlanning ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text
              style={[
                styles.planButtonLabel,
                (!canPlanRoute || isPlanning) && styles.planButtonLabelDisabled,
              ]}
            >
              {t('routePlan.planRoute')}
            </Text>
          )}
        </Pressable>

        {plannedStations != null ? (
          <View style={styles.resultSection}>
            <Text style={styles.summaryTitle}>{t('routePlan.resultTitle')}</Text>
            {routeSource === 'straight' ? (
              <Text style={styles.warning}>{t('routePlan.routesFallback')}</Text>
            ) : null}
            {plannedStations.length === 0 ? (
              <Text style={styles.hint}>{t('routePlan.resultEmpty')}</Text>
            ) : (
              <>
                <Text style={styles.hint}>
                  {routeSource === 'driving'
                    ? t('routePlan.resultCountDriving', {
                        count: plannedStations.length,
                        km: corridorKm,
                      })
                    : t('routePlan.resultCountStraight', {
                        count: plannedStations.length,
                        km: corridorKm,
                      })}
                </Text>
                {plannedStations.map((station) => {
                  const excluded = isRoutePlanStationExcluded(
                    station.id,
                    excludeOptions,
                    getProgress,
                  );

                  return (
                    <PlannedStationRow
                      key={station.id}
                      station={station}
                      excluded={excluded}
                      included={includedStationIds.has(station.id)}
                      onToggleIncluded={() => toggleStationIncluded(station.id)}
                    />
                  );
                })}
                <Text style={styles.hint}>
                  {t('routePlan.mapsWaypointCount', { count: mapsWaypointCount })}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={includedStations.length === 0}
                  style={[
                    styles.mapsButton,
                    includedStations.length === 0 && styles.mapsButtonDisabled,
                  ]}
                  onPress={() => void handleOpenMaps()}
                >
                  <Text
                    style={[
                      styles.mapsButtonLabel,
                      includedStations.length === 0 && styles.mapsButtonLabelDisabled,
                    ]}
                  >
                    {t('routePlan.openInMaps')}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        ) : null}

        <Text style={styles.comingSoon}>{t('routePlan.routeNote')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.background,
  },
  backLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.original,
  },
  topBarTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  content: {
    padding: 20,
    gap: 20,
    paddingBottom: 32,
  },
  intro: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
  },
  originSection: {
    gap: 8,
  },
  useLocationButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  useLocationButtonDisabled: {
    opacity: 0.5,
  },
  useLocationButtonLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.original,
  },
  corridorSection: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  stepperButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepperButtonDisabled: {
    opacity: 0.4,
  },
  stepperButtonLabel: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.original,
    lineHeight: 24,
  },
  stepperValue: {
    minWidth: 96,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  summary: {
    gap: 6,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  summaryBody: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 21,
  },
  planButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.original,
  },
  planButtonDisabled: {
    backgroundColor: colors.border,
  },
  planButtonLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.surface,
  },
  planButtonLabelDisabled: {
    color: colors.textMuted,
  },
  resultSection: {
    gap: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  plannedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  plannedRowFilteredOut: {
    opacity: 0.45,
  },
  stationRow: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  stationRowExcluded: {
    color: colors.textMuted,
  },
  includeToggle: {
    maxWidth: 130,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
  },
  warning: {
    fontSize: 13,
    color: colors.original,
    lineHeight: 20,
    fontWeight: '600',
  },
  mapsButton: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapsButtonDisabled: {
    opacity: 0.5,
  },
  mapsButtonLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.original,
  },
  mapsButtonLabelDisabled: {
    color: colors.textMuted,
  },
  comingSoon: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
  },
});
