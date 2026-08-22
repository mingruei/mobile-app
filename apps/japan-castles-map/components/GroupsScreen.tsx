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
import { useCastleGroups } from '../hooks/useCastleGroups';
import { useCastleProgress } from '../hooks/useCastleProgress';
import { useI18n } from '../i18n';
import type { Castle, ProgressFilter, SeriesFilter } from '../types/castle';
import type { CastleGroup } from '../types/castleGroup';
import { filterCastles, getAvailablePrefectures } from '../utils/filterCastles';
import { shareJpgFile, resolveExportJpgError } from '../utils/exportGroupShowImage';
import { GroupShowView, type GroupShowViewHandle } from './GroupShowView';
import { LocationFilters } from './LocationFilters';

type GroupsScreenProps = {
  castles: readonly Castle[];
  onBack: () => void;
};

type Mode = 'list' | 'create' | 'edit' | 'show';

export function GroupsScreen({ castles, onBack }: GroupsScreenProps) {
  const { t, getPrefectureLabel, getSeriesLabel, formatCount } = useI18n();
  const { groups, createGroup, updateGroup } = useCastleGroups();
  const { progressMap } = useCastleProgress();

  const [mode, setMode] = useState<Mode>('list');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [viewingGroup, setViewingGroup] = useState<CastleGroup | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [groupName, setGroupName] = useState('');
  const [nameError, setNameError] = useState(false);

  const trimmedGroupName = groupName.trim();
  const canSave = trimmedGroupName.length > 0;

  const [series, setSeries] = useState<SeriesFilter>('all');
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('all');
  const [regionId, setRegionId] = useState<RegionId | null>(null);
  const [prefecture, setPrefecture] = useState<string | null>(null);
  const [nameQuery, setNameQuery] = useState('');
  const [exportingJpg, setExportingJpg] = useState(false);
  const [exportJpgError, setExportJpgError] = useState<string | null>(null);
  const showViewRef = useRef<GroupShowViewHandle>(null);

  const castleById = useMemo(() => {
    const map = new Map<number, Castle>();
    for (const castle of castles) {
      map.set(castle.id, castle);
    }
    return map;
  }, [castles]);

  const selectedCastles = useMemo(
    () =>
      selectedIds
        .map((id) => castleById.get(id))
        .filter((castle): castle is Castle => castle != null),
    [castleById, selectedIds],
  );

  const prefectureOptions = useMemo(() => {
    const prefectures = getAvailablePrefectures(castles, regionId, series);
    return [
      { value: null, label: t('common.all') },
      ...prefectures.map((item) => ({
        value: item,
        label: getPrefectureLabel(item),
      })),
    ];
  }, [castles, getPrefectureLabel, regionId, series, t]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filteredCastles = useMemo(
    () =>
      filterCastles(castles, {
        regionId,
        prefecture,
        series,
        nameQuery,
        progressFilter,
        progressMap,
      })
        .filter((castle) => !selectedIdSet.has(castle.id))
        .sort((left, right) => left.number - right.number),
    [
      castles,
      nameQuery,
      prefecture,
      progressFilter,
      progressMap,
      regionId,
      selectedIdSet,
      series,
    ],
  );

  const resetFilters = () => {
    setSeries('all');
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

  const openEdit = (group: CastleGroup) => {
    setViewingGroup(null);
    setEditingGroupId(group.id);
    setSelectedIds([...group.castleIds]);
    setGroupName(group.name);
    setNameError(false);
    resetFilters();
    setMode('edit');
  };

  const openShow = (group: CastleGroup) => {
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

  const addCastle = (castleId: number) => {
    setSelectedIds((current) =>
      current.includes(castleId) ? current : [...current, castleId],
    );
  };

  const removeCastle = (castleId: number) => {
    setSelectedIds((current) => current.filter((id) => id !== castleId));
  };

  const handleSave = async () => {
    if (!trimmedGroupName) {
      setNameError(true);
      return;
    }

    if (mode === 'edit' && editingGroupId) {
      await updateGroup(editingGroupId, {
        name: trimmedGroupName,
        castleIds: selectedIds,
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
          data={filteredCastles}
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

                {selectedCastles.length > 0 ? (
                  <View style={styles.joinedList}>
                    <Text style={styles.joinedTitle}>
                      {t('group.joinedTitle', { count: selectedCastles.length })}
                    </Text>
                    <Text style={styles.joinedHint}>{t('group.joinedHint')}</Text>
                    {selectedCastles.map((castle) => (
                      <Pressable
                        key={castle.id}
                        accessibilityRole="button"
                        onPress={() => removeCastle(castle.id)}
                        style={styles.castleRow}
                      >
                        <Text style={styles.castleRowLabel}>
                          {castle.number} {castle.name}
                        </Text>
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
                  series={series}
                  progressFilter={progressFilter}
                  regionId={regionId}
                  prefecture={prefecture}
                  nameQuery={nameQuery}
                  prefectureOptions={prefectureOptions}
                  onSeriesChange={(next) => {
                    setSeries(next);
                    setNameQuery('');
                  }}
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
                      setSeries('all');
                      setRegionId(null);
                      setPrefecture(null);
                    }
                  }}
                />
                <View style={styles.resultBar}>
                  <Text style={styles.resultCount}>{formatCount(filteredCastles.length)}</Text>
                  <Text style={styles.resultHint}>{t('filter.resultHint')}</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>{t('group.castleListTitle')}</Text>
              <Text style={styles.joinedHint}>{t('group.addHint')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => addCastle(item.id)}
              style={styles.castleRow}
            >
              <Text style={styles.castleRowLabel}>
                {item.number} {item.name}（{getSeriesLabel(item.series)}）
              </Text>
              <Text style={styles.castleRowActionAdd}>{t('group.addCastle')}</Text>
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
  group: CastleGroup;
  castleById: Map<number, Castle>;
  onShow: (group: CastleGroup) => void;
  onEdit: (group: CastleGroup) => void;
}) {
  const { t } = useI18n();
  const names = group.castleIds
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
        {t('group.castleCount', { count: group.castleIds.length })}
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
  joinedTitle: {
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
});
