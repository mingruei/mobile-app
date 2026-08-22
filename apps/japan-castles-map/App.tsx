import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { ActivityIndicator, InteractionManager, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CollectibleUploadSourceModal } from './components/CollectibleUploadSourceModal';
import { GlobalCollectibleUploadFab } from './components/GlobalCollectibleUploadFab';
import { CastleDetailScreen } from './components/CastleDetailScreen';
import { BrowseListHeader } from './components/BrowseListHeader';
import { CastleList } from './components/CastleList';
import { CastleMap } from './components/CastleMap';
import type { RegionId } from './constants/regions';
import { colors } from './constants/theme';
import { MapProviderProvider } from './hooks/useMapProvider';
import { CastleGroupsProvider, useCastleGroups } from './hooks/useCastleGroups';
import { CastleDataProvider, useCastles } from './hooks/useCastleData';
import { CastleProgressProvider, useCastleProgress } from './hooks/useCastleProgress';
import { useConditionalPortraitLock } from './hooks/useConditionalPortraitLock';
import { I18nProvider, useI18n } from './i18n';
import type { Castle, ProgressFilter, SeriesFilter } from './types/castle';
import type { CollectibleKind } from './types/castleCollectible';
import { filterCastles, getAvailablePrefectures } from './utils/filterCastles';
import { resolveLocalStartupContext } from './utils/localPrefecture';
import {
  VISIT_RECORD_UPLOAD_SOURCES,
  type CollectibleUploadSource,
} from './utils/castleCollectibleUpload';
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
  castleId: number;
  kind: CollectibleKind;
};

function AppContent() {
  const { t, getPrefectureLabel } = useI18n();
  const castles = useCastles();
  const { progressMap } = useCastleProgress();
  const { groups } = useCastleGroups();
  useConditionalPortraitLock();
  const [screen, setScreen] = useState<Screen>('browse');
  const [returnScreen, setReturnScreen] = useState<MainScreen>('browse');
  const [series, setSeries] = useState<SeriesFilter>('all');
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('all');
  const [groupFilterId, setGroupFilterId] = useState<string | null>(null);
  const [regionId, setRegionId] = useState<RegionId | null>(null);
  const [prefecture, setPrefecture] = useState<string | null>(null);
  const [nameQuery, setNameQuery] = useState('');
  const [selectedCastle, setSelectedCastle] = useState<Castle | null>(null);
  const [detailUploadPicker, setDetailUploadPicker] = useState<DetailUploadPickerState | null>(null);
  const openUploadRef = useRef<(() => void) | null>(null);
  const detailUploadHandlersRef = useRef(
    new Map<string, (source: CollectibleUploadSource) => Promise<void>>(),
  );

  const registerOpenUpload = useCallback((open: () => void) => {
    openUploadRef.current = open;
  }, []);

  useEffect(() => {
    if (castles.length === 0) {
      return;
    }

    let active = true;
    const task = InteractionManager.runAfterInteractions(() => {
      void resolveLocalStartupContext(castles).then((result) => {
        if (!active) {
          return;
        }

        if (result.filter) {
          setRegionId(result.filter.regionId);
          setPrefecture(result.filter.prefecture);
        }

        if (result.nearbyCastle) {
          setReturnScreen('browse');
          setSelectedCastle(result.nearbyCastle);
          setScreen('detail');
        }
      });
    });

    return () => {
      active = false;
      task.cancel();
    };
  }, [castles]);

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

  const groupCastleIdSet = useMemo(() => {
    if (!groupFilterId) {
      return undefined;
    }

    const group = groups.find((item) => item.id === groupFilterId);
    if (!group) {
      return undefined;
    }

    return new Set(group.castleIds);
  }, [groupFilterId, groups]);

  const prefectureOptions = useMemo(() => {
    const prefectures = getAvailablePrefectures(castles, regionId, series);
    return [
      { value: null, label: t('common.all') },
      ...prefectures.map((item) => ({
        value: item,
        label: getPrefectureLabel(item),
      })),
    ];
  }, [getPrefectureLabel, regionId, series, t]);

  const filteredCastles = useMemo(
    () =>
      filterCastles(castles, {
        regionId,
        prefecture,
        series,
        nameQuery,
        progressFilter,
        progressMap,
        groupCastleIdSet,
      }).sort((left, right) => left.number - right.number),
    [groupCastleIdSet, nameQuery, prefecture, progressFilter, progressMap, regionId, series],
  );

  const openCastleDetail = (castle: Castle) => {
    setReturnScreen(screen === 'map' ? 'map' : 'browse');
    setSelectedCastle(castle);
    setScreen('detail');
  };

  const handleBackFromDetail = () => {
    setDetailUploadPicker(null);
    setScreen(returnScreen);
    setSelectedCastle(null);
  };

  const registerDetailUploadHandler = useCallback(
    (castleId: number, kind: CollectibleKind, handler: (source: CollectibleUploadSource) => Promise<void>) => {
      detailUploadHandlersRef.current.set(`${castleId}:${kind}`, handler);
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

      const uploadFromSource = detailUploadHandlersRef.current.get(`${picker.castleId}:${picker.kind}`);
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
      setSelectedCastle(null);
    }
  };

  const handleSeriesChange = (nextSeries: SeriesFilter) => {
    setSeries(nextSeries);
    setNameQuery('');
    closeDetailIfOpen();
  };

  const handleRegionChange = (nextRegionId: RegionId | null) => {
    setRegionId(nextRegionId);
    setPrefecture(null);
    setNameQuery('');
    closeDetailIfOpen();
  };

  const handlePrefectureChange = (nextPrefecture: string | null) => {
    setPrefecture(nextPrefecture);
    setNameQuery('');
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

  const handleNameQueryChange = (nextNameQuery: string) => {
    setNameQuery(nextNameQuery);
    if (nextNameQuery.trim()) {
      setSeries('all');
      setRegionId(null);
      setPrefecture(null);
    }
    closeDetailIfOpen();
  };

  const isDetailOpen = screen === 'detail' && selectedCastle !== null;
  const isSettingsOpen = screen === 'settings';
  const isGroupsOpen = screen === 'groups';
  const isOverlayOpen = isDetailOpen || isSettingsOpen || isGroupsOpen;
  const activeMainScreen: MainScreen =
    screen === 'browse' || screen === 'map' ? screen : returnScreen;

  const openSettings = () => {
    setReturnScreen(activeMainScreen);
    setScreen('settings');
    setSelectedCastle(null);
  };

  const openGroups = () => {
    setReturnScreen(activeMainScreen);
    setScreen('groups');
    setSelectedCastle(null);
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
                <Text style={styles.subtitle} numberOfLines={1}>
                  {t('app.subtitle')}
                </Text>
              </View>

              <View style={styles.headerActionsRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => openUploadRef.current?.()}
                  style={styles.headerButton}
                >
                  <Text style={styles.headerButtonLabel}>{t('globalUpload.fabLabel')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setScreen((current) => (current === 'browse' ? 'map' : 'browse'));
                    setSelectedCastle(null);
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
            <CastleList
              castles={filteredCastles}
              onSelectCastle={openCastleDetail}
              ListHeaderComponent={
                <BrowseListHeader
                  series={series}
                  progressFilter={progressFilter}
                  regionId={regionId}
                  prefecture={prefecture}
                  nameQuery={nameQuery}
                  prefectureOptions={prefectureOptions}
                  groupOptions={groupOptions}
                  groupId={groupFilterId}
                  resultCount={filteredCastles.length}
                  onSeriesChange={handleSeriesChange}
                  onProgressFilterChange={handleProgressFilterChange}
                  onGroupChange={handleGroupFilterChange}
                  onRegionChange={handleRegionChange}
                  onPrefectureChange={handlePrefectureChange}
                  onNameQueryChange={handleNameQueryChange}
                />
              }
            />
          ) : (
            <CastleMap castles={filteredCastles} onSelectCastle={openCastleDetail} />
          )}
        </View>

        {isDetailOpen ? (
          <SafeAreaView style={styles.detailLayer} edges={['top', 'left', 'right', 'bottom']}>
            <CastleDetailScreen
              castle={selectedCastle}
              onBack={handleBackFromDetail}
              onRequestUpload={(kind) =>
                setDetailUploadPicker({ castleId: selectedCastle.id, kind })
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
              <GroupsScreen castles={castles} onBack={handleBackFromGroups} />
            </Suspense>
          </SafeAreaView>
        ) : null}
      </View>

      <GlobalCollectibleUploadFab
        castles={castles}
        enabled={!isOverlayOpen}
        onRegisterOpen={registerOpenUpload}
      />

      <CollectibleUploadSourceModal
        visible={detailUploadPicker != null}
        sources={
          detailUploadPicker?.kind === 'visit-record'
            ? VISIT_RECORD_UPLOAD_SOURCES
            : undefined
        }
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
        <CastleDataProvider>
          <MapProviderProvider>
            <CastleProgressProvider>
              <CastleGroupsProvider>
                <AppContent />
              </CastleGroupsProvider>
            </CastleProgressProvider>
          </MapProviderProvider>
        </CastleDataProvider>
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
    flexShrink: 0,
  },
  subtitle: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
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
