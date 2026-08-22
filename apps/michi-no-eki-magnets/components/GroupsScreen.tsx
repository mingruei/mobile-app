import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { type RegionId } from '../constants/regions';
import { colors } from '../constants/theme';
import { useStationGroups } from '../hooks/useStationGroups';
import { useStationProgress } from '../hooks/useStationProgress';
import { useI18n } from '../i18n';
import type { Station, ProgressFilter } from '../types/station';
import type { StationGroup } from '../types/stationGroup';
import { filterStations, getAvailablePrefectures } from '../utils/filterStations';
import { shareJpgFile, resolveExportJpgError } from '../utils/exportGroupShowImage';
import { GroupShowView, type GroupShowViewHandle } from './GroupShowView';
import { LocationFilters } from './LocationFilters';

type GroupsScreenProps = {
  stations: readonly Station[];
  onBack: () => void;
};

type Mode = 'list' | 'create' | 'edit' | 'show';

export function GroupsScreen({ stations, onBack }: GroupsScreenProps) {
  const { t, getPrefectureLabel, formatCount } = useI18n();
  const { groups, createGroup, updateGroup } = useStationGroups();
  const { progressMap } = useStationProgress();

  const [mode, setMode] = useState<Mode>('list');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [viewingGroup, setViewingGroup] = useState<StationGroup | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [groupName, setGroupName] = useState('');
  const [nameError, setNameError] = useState(false);

  const trimmedGroupName = groupName.trim();
  const canSave = trimmedGroupName.length > 0;

  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('all');
  const [regionId, setRegionId] = useState<RegionId | null>(null);
  const [prefecture, setPrefecture] = useState<string | null>(null);
  const [nameQuery, setNameQuery] = useState('');
  const [exportingJpg, setExportingJpg] = useState(false);
  const [exportJpgError, setExportJpgError] = useState<string | null>(null);
  const showViewRef = useRef<GroupShowViewHandle>(null);

  const castleById = useMemo(() => {
    const map = new Map<number, Station>();
    for (const station of stations) {
      map.set(station.id, station);
    }
    return map;
  }, [stations]);

  const selectedStations = useMemo(
    () =>
      selectedIds
        .map((id) => castleById.get(id))
        .filter((station): station is Station => station != null),
    [castleById, selectedIds],
  );

  const prefectureOptions = useMemo(() => {
    const prefectures = getAvailablePrefectures(stations, regionId);
    return [
      { value: null, label: t('common.all') },
      ...prefectures.map((item) => ({
        value: item,
        label: getPrefectureLabel(item),
      })),
    ];
  }, [stations, getPrefectureLabel, regionId, t]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const stationsMatchingFilters = useMemo(
    () =>
      filterStations(stations, {
        regionId,
        prefecture,
        selectedServices: [],
        nameQuery,
        progressFilter,
        progressMap,
      }).sort((left, right) => left.number - right.number),
    [stations, nameQuery, prefecture, progressFilter, progressMap, regionId],
  );

  const filteredStations = useMemo(
    () => stationsMatchingFilters.filter((station) => !selectedIdSet.has(station.id)),
    [stationsMatchingFilters, selectedIdSet],
  );

  const resetFilters = () => {
    setProgressFilter('all');
    setRegionId(null);
    setPrefecture(null);
    setNameQuery('');
  };

  const openCreate = () => {
    setEditingGroupId(null);
    setViewingGroup(null);
    setSelectedIds([]);
    setGroupName('');
    setNameError(false);
    resetFilters();
    setMode('create');
  };

  const openEdit = (group: StationGroup) => {
    setViewingGroup(null);
    setEditingGroupId(group.id);
    setSelectedIds([...group.stationIds]);
    setGroupName(group.name);
    setNameError(false);
    resetFilters();
    setMode('edit');
  };

  const openShow = (group: StationGroup) => {
    setEditingGroupId(null);
    setViewingGroup(group);
    setExportJpgError(null);
    setMode('show');
  };

  const handleBack = () => {
    if (mode !== 'list') {
      setEditingGroupId(null);
      setViewingGroup(null);
      setExportJpgError(null);
      setMode('list');
      return;
    }
    onBack();
  };

  const addStation = (stationId: number) => {
    setSelectedIds((current) =>
      current.includes(stationId) ? current : [...current, stationId],
    );
  };

  const removeCastle = (stationId: number) => {
    setSelectedIds((current) => current.filter((id) => id !== stationId));
  };

  const addAllFiltered = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const station of stationsMatchingFilters) {
        next.add(station.id);
      }
      return [...next];
    });
  };

  const removeAllSelected = () => {
    setSelectedIds([]);
  };

  const handleSave = async () => {
    if (!trimmedGroupName) {
      setNameError(true);
      return;
    }

    if (mode === 'edit' && editingGroupId) {
      await updateGroup(editingGroupId, {
        name: trimmedGroupName,
        stationIds: selectedIds,
      });
    } else {
      await createGroup(trimmedGroupName, selectedIds);
    }

    setNameError(false);
    setEditingGroupId(null);
    setMode('list');
  };

  const handleExportJpg = async () => {
    if (exportingJpg) {
      return;
    }

    if (!showViewRef.current) {
      setExportJpgError(t('group.exportJpgFailed'));
      return;
    }

    setExportingJpg(true);
    setExportJpgError(null);

    try {
      const uri = await showViewRef.current.exportJpg();
      await shareJpgFile(uri);
    } catch (error) {
      setExportJpgError(resolveExportJpgError(error, t));
    } finally {
      setExportingJpg(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backLabel}>{t('common.back')}</Text>
        </Pressable>
        {mode === 'list' ? (
          <Text style={styles.title}>{t('group.title')}</Text>
        ) : mode === 'show' ? (
          <View style={styles.showHeader}>
            <Text style={styles.showTitle} numberOfLines={1}>
              {viewingGroup?.name ?? ''}
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={exportingJpg}
              onPress={() => void handleExportJpg()}
              style={[styles.exportButton, exportingJpg && styles.exportButtonDisabled]}
            >
              {exportingJpg ? (
                <ActivityIndicator size="small" color={colors.original} />
              ) : (
                <Text style={styles.exportButtonLabel}>{t('group.exportJpg')}</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            disabled={!canSave}
            onPress={() => void handleSave()}
            style={[styles.headerSaveButton, !canSave && styles.headerSaveButtonDisabled]}
          >
            <Text style={[styles.headerSaveLabel, !canSave && styles.headerSaveLabelDisabled]}>
              {t('group.save')}
            </Text>
          </Pressable>
        )}
      </View>

      {mode === 'list' ? (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              {groups.length > 0 ? (
                <Text style={styles.sectionTitle}>{t('group.listTitle')}</Text>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <GroupListRow
              group={item}
              castleById={castleById}
              onShow={openShow}
              onEdit={openEdit}
            />
          )}
          ListFooterComponent={
            <Pressable
              accessibilityRole="button"
              onPress={openCreate}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonLabel}>{t('group.add')}</Text>
            </Pressable>
          }
          ListEmptyComponent={null}
        />
      ) : mode === 'show' && viewingGroup ? (
        <View style={styles.showContainer}>
          {exportJpgError ? (
            <View style={styles.exportErrorBar}>
              <Text style={styles.exportErrorText}>{exportJpgError}</Text>
            </View>
          ) : null}
          <GroupShowView ref={showViewRef} group={viewingGroup} castleById={castleById} />
        </View>
      ) : (
        <FlatList
          data={filteredStations}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.createHeader}>
              <View style={styles.joinedSection}>
                <Text style={styles.fieldLabel}>{t('group.nameLabel')} *</Text>
                <TextInput
                  value={groupName}
                  onChangeText={(next) => {
                    setGroupName(next);
                    if (next.trim()) {
                      setNameError(false);
                    }
                  }}
                  placeholder={t('group.namePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.nameInput, nameError && styles.nameInputError]}
                />
                {nameError ? (
                  <Text style={styles.fieldError}>{t('group.nameRequired')}</Text>
                ) : null}

                {selectedStations.length > 0 ? (
                  <View style={styles.joinedList}>
                    <View style={styles.joinedListHeader}>
                      <Text style={styles.joinedTitle}>
                        {t('group.joinedTitle', { count: selectedStations.length })}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        onPress={removeAllSelected}
                        style={styles.bulkActionButton}
                      >
                        <Text style={styles.bulkActionLabelMuted}>{t('group.removeAllSelected')}</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.joinedHint}>{t('group.joinedHint')}</Text>
                    {selectedStations.map((station) => (
                      <Pressable
                        key={station.id}
                        accessibilityRole="button"
                        onPress={() => removeCastle(station.id)}
                        style={styles.castleRow}
                      >
                        <Text style={styles.castleRowLabel}>{station.name}</Text>
                        <Text style={styles.castleRowAction}>{t('group.remove')}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>

              <View style={styles.filterSection}>
                <Text style={[styles.sectionTitle, styles.filterSectionTitle]}>
                  {t('group.filterTitle')}
                </Text>
                <LocationFilters
                  progressFilter={progressFilter}
                  regionId={regionId}
                  prefecture={prefecture}
                  nameQuery={nameQuery}
                  prefectureOptions={prefectureOptions}
                  onProgressFilterChange={setProgressFilter}
                  onRegionChange={(next) => {
                    setRegionId(next);
                    setPrefecture(null);
                    setNameQuery('');
                  }}
                  onPrefectureChange={(next) => {
                    setPrefecture(next);
                    setNameQuery('');
                  }}
                  onNameQueryChange={(next) => {
                    setNameQuery(next);
                    if (next.trim()) {
                      setRegionId(null);
                      setPrefecture(null);
                    }
                  }}
                />
                <View style={styles.resultBar}>
                  <Text style={styles.resultCount}>{formatCount(filteredStations.length)}</Text>
                  <Text style={styles.resultHint}>{t('filter.resultHint')}</Text>
                </View>
                <View style={styles.bulkActionRow}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={stationsMatchingFilters.length === 0}
                    onPress={addAllFiltered}
                    style={[
                      styles.bulkActionButton,
                      stationsMatchingFilters.length === 0 && styles.bulkActionButtonDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.bulkActionLabel,
                        stationsMatchingFilters.length === 0 && styles.bulkActionLabelDisabled,
                      ]}
                    >
                      {t('group.addAllFiltered')}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={selectedIds.length === 0}
                    onPress={removeAllSelected}
                    style={[
                      styles.bulkActionButton,
                      selectedIds.length === 0 && styles.bulkActionButtonDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.bulkActionLabelMuted,
                        selectedIds.length === 0 && styles.bulkActionLabelDisabled,
                      ]}
                    >
                      {t('group.removeAllSelected')}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <Text style={styles.sectionTitle}>{t('group.stationListTitle')}</Text>
              <Text style={styles.joinedHint}>{t('group.addHint')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => addStation(item.id)}
              style={styles.castleRow}
            >
              <Text style={styles.castleRowLabel}>{item.name}</Text>
              <Text style={styles.castleRowActionAdd}>{t('group.addStation')}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function GroupListRow({
  group,
  castleById,
  onShow,
  onEdit,
}: {
  group: StationGroup;
  castleById: Map<number, Station>;
  onShow: (group: StationGroup) => void;
  onEdit: (group: StationGroup) => void;
}) {
  const { t } = useI18n();
  const names = group.stationIds
    .map((id) => castleById.get(id)?.name)
    .filter((name): name is string => Boolean(name));

  return (
    <View style={styles.groupCard}>
      <View style={styles.groupNameRow}>
        <Text style={styles.groupName} numberOfLines={1}>
          {group.name}
        </Text>
        <View style={styles.groupActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onShow(group)}
            style={styles.groupActionButton}
          >
            <Text style={styles.groupActionLabel}>{t('group.show')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => onEdit(group)}
            style={styles.groupActionButton}
          >
            <Text style={styles.groupActionLabel}>{t('group.edit')}</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.groupMeta}>
        {t('group.stationCount', { count: group.stationIds.length })}
      </Text>
      {names.length > 0 ? (
        <Text style={styles.groupPreview} numberOfLines={2}>
          {names.join('、')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  backLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.original,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  showHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  showTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  exportButton: {
    minWidth: 72,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  exportButtonDisabled: {
    opacity: 0.6,
  },
  exportButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.original,
  },
  showContainer: {
    flex: 1,
  },
  exportErrorBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.continuedLight,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  exportErrorText: {
    fontSize: 13,
    color: colors.continued,
    lineHeight: 18,
  },
  headerSaveButton: {
    flex: 1,
    paddingVertical: 6,
  },
  headerSaveButtonDisabled: {
    opacity: 0.4,
  },
  headerSaveLabel: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.original,
  },
  headerSaveLabelDisabled: {
    color: colors.textMuted,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 8,
  },
  listHeader: {
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  filterSectionTitle: {
    paddingHorizontal: 16,
  },
  groupCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
    marginBottom: 8,
  },
  groupNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  groupName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  groupActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  groupActionButton: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  groupActionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.original,
  },
  groupMeta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  groupPreview: {
    fontSize: 13,
    color: colors.text,
    marginTop: 4,
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: colors.original,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonLabel: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  createHeader: {
    gap: 4,
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 4,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
    marginBottom: 4,
  },
  nameInputError: {
    borderColor: colors.continued,
  },
  fieldError: {
    fontSize: 13,
    color: colors.continued,
    marginBottom: 4,
  },
  joinedSection: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
  },
  joinedList: {
    marginTop: 8,
    gap: 4,
  },
  joinedListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  joinedTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  joinedHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 8,
  },
  castleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  castleRowLabel: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  castleRowAction: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.continued,
  },
  castleRowActionAdd: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.original,
  },
  filterSection: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingBottom: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  resultBar: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
  },
  resultCount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  resultHint: {
    fontSize: 13,
    color: colors.textMuted,
  },
  bulkActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 16,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  bulkActionButton: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  bulkActionButtonDisabled: {
    opacity: 0.4,
  },
  bulkActionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.original,
  },
  bulkActionLabelMuted: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.continued,
  },
  bulkActionLabelDisabled: {
    color: colors.textMuted,
  },
});
