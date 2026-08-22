import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { ActivityIndicator, InteractionManager, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CollectibleUploadSourceModal } from './components/CollectibleUploadSourceModal';
import { StationDetailScreen } from './components/StationDetailScreen';
import { BrowseListHeader } from './components/BrowseListHeader';
import { StationList } from './components/StationList';
import { StationMap } from './components/StationMap';
import type { RegionId } from './constants/regions';
import { colors } from './constants/theme';
import { MapProviderProvider } from './hooks/useMapProvider';
import { StationGroupsProvider, useStationGroups } from './hooks/useStationGroups';
import { StationDataProvider, useStations } from './hooks/useStationData';
import { StationProgressProvider, useStationProgress } from './hooks/useStationProgress';
import { useConditionalPortraitLock } from './hooks/useConditionalPortraitLock';
import { I18nProvider, useI18n } from './i18n';
import type { Station, ProgressFilter } from './types/station';
import type { StationServiceId } from './constants/stationServices';
import type { CollectibleKind } from './types/stationCollectible';
import { filterStations, getAvailablePrefectures } from './utils/filterStations';
import { resolveLocalStartupContext } from './utils/localPrefecture';
import {
  type CollectibleUploadSource,
} from './utils/stationCollectibleUpload';
import { waitForNativePicker } from './utils/waitForNativePicker';

const SettingsScreen = lazy(() =>
  import('./components/SettingsScreen').then((module) => ({ default: module.SettingsScreen })),
);
const GroupsScreen = lazy(() =>
  import('./components/GroupsScreen').then((module) => ({ default: module.GroupsScreen })),
);

type MainScreen = 'browse' | 'map';
type Screen = MainScreen | 'detail' | 'settings' | 'groups';

type DetailUploadPickerState = {
  stationId: number;
  kind: CollectibleKind;
};

function AppContent() {
  const { t, getPrefectureLabel } = useI18n();
  const stations = useStations();
  const { progressMap } = useStationProgress();
  const { groups } = useStationGroups();
  useConditionalPortraitLock();
  const [screen, setScreen] = useState<Screen>('browse');
  const [returnScreen, setReturnScreen] = useState<MainScreen>('browse');
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('all');
  const [groupFilterId, setGroupFilterId] = useState<string | null>(null);
  const [regionId, setRegionId] = useState<RegionId | null>(null);
  const [prefecture, setPrefecture] = useState<string | null>(null);
  const [selectedServices, setSelectedServices] = useState<StationServiceId[]>([]);
  const [nameQuery, setNameQuery] = useState('');
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [detailUploadPicker, setDetailUploadPicker] = useState<DetailUploadPickerState | null>(null);
  const detailUploadHandlersRef = useRef(
    new Map<string, (source: CollectibleUploadSource) => Promise<void>>(),
  );

  useEffect(() => {
    if (stations.length === 0) {
      return;
    }

    let active = true;
    const task = InteractionManager.runAfterInteractions(() => {
      void resolveLocalStartupContext(stations).then((result) => {
        if (!active) {
          return;
        }

        if (result.filter) {
          setRegionId(result.filter.regionId);
          setPrefecture(result.filter.prefecture);
        }

        if (result.nearbyStation) {
          setReturnScreen('browse');
          setSelectedStation(result.nearbyStation);
          setScreen('detail');
        }
      });
    });

    return () => {
      active = false;
      task.cancel();
    };
  }, [stations]);

  useEffect(() => {
    if (groupFilterId && !groups.some((group) => group.id === groupFilterId)) {
      setGroupFilterId(null);
    }
  }, [groupFilterId, groups]);

  const groupOptions = useMemo(() => {
    if (groups.length === 0) {
      return undefined;
    }

    return [
      { value: null, label: t('common.all') },
      ...groups.map((group) => ({
        value: group.id,
        label: group.name,
      })),
    ];
  }, [groups, t]);

  const groupStationIdSet = useMemo(() => {
    if (!groupFilterId) {
      return undefined;
    }

    const group = groups.find((item) => item.id === groupFilterId);
    if (!group) {
      return undefined;
    }

    return new Set(group.stationIds);
  }, [groupFilterId, groups]);

  const prefectureOptions = useMemo(() => {
    const prefectures = getAvailablePrefectures(stations, regionId);
    return [
      { value: null, label: t('common.all') },
      ...prefectures.map((item) => ({
        value: item,
        label: getPrefectureLabel(item),
      })),
    ];
  }, [getPrefectureLabel, regionId, t]);

  const filteredStations = useMemo(
    () =>
      filterStations(stations, {
        regionId,
        prefecture,
        selectedServices,
        nameQuery,
        progressFilter,
        progressMap,
        groupStationIdSet,
      }).sort((left, right) => left.number - right.number),
    [groupStationIdSet, nameQuery, selectedServices, prefecture, progressFilter, progressMap, regionId, stations],
  );

  const openStationDetail = (station: Station) => {
    setReturnScreen(screen === 'map' ? 'map' : 'browse');
    setSelectedStation(station);
    setScreen('detail');
  };

  const handleBackFromDetail = () => {
    setDetailUploadPicker(null);
    setScreen(returnScreen);
    setSelectedStation(null);
  };

  const registerDetailUploadHandler = useCallback(
    (stationId: number, kind: CollectibleKind, handler: (source: CollectibleUploadSource) => Promise<void>) => {
      detailUploadHandlersRef.current.set(`${stationId}:${kind}`, handler);
    },
    [],
  );

  const handleDetailUploadSelect = useCallback(
    async (source: CollectibleUploadSource) => {
      const picker = detailUploadPicker;
      setDetailUploadPicker(null);
      if (!picker) {
        return;
      }

      await waitForNativePicker();

      const uploadFromSource = detailUploadHandlersRef.current.get(`${picker.stationId}:${picker.kind}`);
      if (!uploadFromSource) {
        return;
      }

      await uploadFromSource(source);
    },
    [detailUploadPicker],
  );

  const closeDetailIfOpen = () => {
    if (screen === 'detail') {
      setDetailUploadPicker(null);
      setScreen(returnScreen);
      setSelectedStation(null);
    }
  };

  const handleRegionChange = (nextRegionId: RegionId | null) => {
    setRegionId(nextRegionId);
    setPrefecture(null);
    closeDetailIfOpen();
  };

  const handlePrefectureChange = (nextPrefecture: string | null) => {
    setPrefecture(nextPrefecture);
    closeDetailIfOpen();
  };

  const handleNameQueryChange = (nextNameQuery: string) => {
    setNameQuery(nextNameQuery);
    closeDetailIfOpen();
  };

  const handleProgressFilterChange = (nextProgressFilter: ProgressFilter) => {
    setProgressFilter(nextProgressFilter);
    closeDetailIfOpen();
  };

  const handleGroupFilterChange = (nextGroupId: string | null) => {
    setGroupFilterId(nextGroupId);
    closeDetailIfOpen();
  };

  const handleServicesChange = (services: StationServiceId[]) => {
    setSelectedServices(services);
    closeDetailIfOpen();
  };

  const isDetailOpen = screen === 'detail' && selectedStation !== null;
  const isSettingsOpen = screen === 'settings';
  const isGroupsOpen = screen === 'groups';
  const isOverlayOpen = isDetailOpen || isSettingsOpen || isGroupsOpen;
  const activeMainScreen: MainScreen =
    screen === 'browse' || screen === 'map' ? screen : returnScreen;

  const openSettings = () => {
    setReturnScreen(activeMainScreen);
    setScreen('settings');
    setSelectedStation(null);
  };

  const openGroups = () => {
    setReturnScreen(activeMainScreen);
    setScreen('groups');
    setSelectedStation(null);
  };

  const handleBackFromSettings = () => {
    setScreen(returnScreen);
  };

  const handleBackFromGroups = () => {
    setScreen(returnScreen);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.root}>
        <View style={styles.mainContent} pointerEvents={isOverlayOpen ? 'none' : 'auto'}>
          {!isOverlayOpen ? (
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <Text style={styles.title}>{t('app.title')}</Text>
              </View>

              <View style={styles.headerActionsRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setScreen((current) => (current === 'browse' ? 'map' : 'browse'));
                    setSelectedStation(null);
                  }}
                  style={[
                    styles.headerButton,
                    activeMainScreen === 'map' && styles.headerButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.headerButtonLabel,
                      activeMainScreen === 'map' && styles.headerButtonLabelActive,
                    ]}
                  >
                    {t('screen.map')}
                  </Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={openGroups} style={styles.headerButton}>
                  <Text style={styles.headerButtonLabel}>{t('screen.group')}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={openSettings} style={styles.headerButton}>
                  <Text style={styles.headerButtonLabel}>{t('screen.settings')}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {activeMainScreen === 'browse' ? (
            <StationList
              stations={filteredStations}
              onSelectStation={openStationDetail}
              ListHeaderComponent={
                <BrowseListHeader
                  progressFilter={progressFilter}
                  regionId={regionId}
                  prefecture={prefecture}
                  selectedServices={selectedServices}
                  nameQuery={nameQuery}
                  prefectureOptions={prefectureOptions}
                  groupOptions={groupOptions}
                  groupId={groupFilterId}
                  resultCount={filteredStations.length}
                  onProgressFilterChange={handleProgressFilterChange}
                  onGroupChange={handleGroupFilterChange}
                  onRegionChange={handleRegionChange}
                  onPrefectureChange={handlePrefectureChange}
                  onNameQueryChange={handleNameQueryChange}
                  onServicesChange={handleServicesChange}
                />
              }
            />
          ) : (
            <StationMap stations={filteredStations} onSelectStation={openStationDetail} />
          )}
        </View>

        {isDetailOpen ? (
          <SafeAreaView style={styles.detailLayer} edges={['top', 'left', 'right', 'bottom']}>
            <StationDetailScreen
              station={selectedStation}
              onBack={handleBackFromDetail}
              onRequestUpload={(kind) =>
                setDetailUploadPicker({ stationId: selectedStation.id, kind })
              }
              onRegisterUpload={registerDetailUploadHandler}
            />
          </SafeAreaView>
        ) : null}

        {isSettingsOpen ? (
          <SafeAreaView style={styles.detailLayer} edges={['top', 'left', 'right', 'bottom']}>
            <Suspense
              fallback={
                <View style={styles.settingsLoading}>
                  <ActivityIndicator size="large" color={colors.original} />
                </View>
              }
            >
              <SettingsScreen onBack={handleBackFromSettings} />
            </Suspense>
          </SafeAreaView>
        ) : null}

        {isGroupsOpen ? (
          <SafeAreaView style={styles.detailLayer} edges={['top', 'left', 'right', 'bottom']}>
            <Suspense
              fallback={
                <View style={styles.settingsLoading}>
                  <ActivityIndicator size="large" color={colors.original} />
                </View>
              }
            >
              <GroupsScreen stations={stations} onBack={handleBackFromGroups} />
            </Suspense>
          </SafeAreaView>
        ) : null}
      </View>

      <CollectibleUploadSourceModal
        visible={detailUploadPicker != null}
        onClose={() => setDetailUploadPicker(null)}
        onSelect={(source) => void handleDetailUploadSelect(source)}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <I18nProvider>
        <StationDataProvider>
          <MapProviderProvider>
            <StationProgressProvider>
              <StationGroupsProvider>
                <AppContent />
              </StationGroupsProvider>
            </StationProgressProvider>
          </MapProviderProvider>
        </StationDataProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  root: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
  },
  detailLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
  },
  settingsLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    minWidth: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerButtonActive: {
    borderColor: colors.original,
    backgroundColor: colors.originalLight,
  },
  headerButtonLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  headerButtonLabelActive: {
    color: colors.original,
  },
});
