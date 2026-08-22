import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../constants/theme';
import type { GlobalUploadDraft } from '../hooks/useGlobalCollectibleUpload';
import { hasCastleCardSalesLocation } from '../i18n/castleContent';
import { useI18n } from '../i18n';
import type { CollectibleKind } from '../types/castleCollectible';
import type { Castle } from '../types/castle';
import { filterCastlesByQuery } from '../utils/castleNameMatching';
import { getDisplayImageUri } from '../utils/collectibleFileIO';

type CollectibleUploadConfirmModalProps = {
  visible: boolean;
  draft: GlobalUploadDraft;
  castles: readonly Castle[];
  saving: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onConfirm: (castleId: number, kind: CollectibleKind) => void;
};

const KIND_OPTIONS: CollectibleKind[] = ['meijo-stamp', 'goshuin', 'castle-card'];

function getKindLabel(kind: CollectibleKind, t: (key: string) => string): string {
  switch (kind) {
    case 'meijo-stamp':
      return t('castle.meijoStamp');
    case 'goshuin':
      return t('castle.goshuin');
    case 'castle-card':
      return t('castle.castleCard');
    case 'visit-record':
      return t('castle.visitRecordUploadTitle');
  }
}

function getTypeHint(kind: CollectibleKind, t: (key: string) => string): string {
  switch (kind) {
    case 'meijo-stamp':
      return t('globalUpload.typeHintMeijoStamp');
    case 'castle-card':
      return t('globalUpload.typeHintCastleCard');
    case 'goshuin':
      return t('globalUpload.typeHintGoshuin');
    case 'visit-record':
      return t('castle.visitRecordUploadHint');
  }
}

export function CollectibleUploadConfirmModal({
  visible,
  draft,
  castles,
  saving,
  errorMessage = null,
  onClose,
  onConfirm,
}: CollectibleUploadConfirmModalProps) {
  const { t, getSeriesLabel } = useI18n();
  const insets = useSafeAreaInsets();
  const [selectedKind, setSelectedKind] = useState<CollectibleKind>(draft.typeSuggestion.kind);
  const [selectedCastleId, setSelectedCastleId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCastles = useMemo(() => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      return [];
    }

    return filterCastlesByQuery(castles, trimmedQuery).slice(0, 30);
  }, [castles, searchQuery]);

  const kindOptions = useMemo(() => {
    if (selectedCastleId == null || hasCastleCardSalesLocation(selectedCastleId)) {
      return KIND_OPTIONS;
    }

    return KIND_OPTIONS.filter((kind) => kind !== 'castle-card');
  }, [selectedCastleId]);

  useEffect(() => {
    if (selectedCastleId != null && selectedKind === 'castle-card' && !hasCastleCardSalesLocation(selectedCastleId)) {
      setSelectedKind('meijo-stamp');
    }
  }, [selectedCastleId, selectedKind]);

  const canConfirm =
    selectedCastleId != null
    && !saving
    && (selectedKind !== 'castle-card' || hasCastleCardSalesLocation(selectedCastleId));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('globalUpload.confirmTitle')}</Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeLabel}>{t('common.close')}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Image
            source={{ uri: getDisplayImageUri(draft.selection.uri) }}
            style={styles.preview}
            resizeMode="contain"
          />

          <Text style={styles.sectionLabel}>{t('globalUpload.typeLabel')}</Text>
          <View style={styles.kindRow}>
            {kindOptions.map((kind) => {
              const selected = selectedKind === kind;
              const suggested = draft.typeSuggestion.kind === kind;
              return (
                <Pressable
                  key={kind}
                  accessibilityRole="button"
                  onPress={() => setSelectedKind(kind)}
                  style={[styles.kindOption, selected && styles.kindOptionSelected]}
                >
                  <Text style={[styles.kindLabel, selected && styles.kindLabelSelected]}>
                    {getKindLabel(kind, t)}
                  </Text>
                  {suggested ? (
                    <Text style={styles.suggestedBadge}>{t('globalUpload.suggested')}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>{getTypeHint(selectedKind, t)}</Text>

          <Text style={styles.sectionLabel}>{t('globalUpload.castleLabel')}</Text>
          <Text style={styles.hint}>{t('globalUpload.castleSearchHint')}</Text>

          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('globalUpload.castleSearchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
          />

          <View style={styles.castleList}>
            {filteredCastles.map((castle) => {
              const selected = selectedCastleId === castle.id;
              return (
                <Pressable
                  key={castle.id}
                  accessibilityRole="button"
                  onPress={() => setSelectedCastleId(castle.id)}
                  style={[styles.castleRow, selected && styles.castleRowSelected]}
                >
                  <View style={styles.castleRowText}>
                    <Text style={styles.castleName}>
                      {t('common.number')} {castle.number} · {castle.name}
                    </Text>
                    <Text style={styles.castleMeta}>
                      {getSeriesLabel(castle.series)} · {castle.location}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          disabled={!canConfirm}
          onPress={() => {
            if (selectedCastleId != null) {
              onConfirm(selectedCastleId, selectedKind);
            }
          }}
          style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.surface} />
          ) : (
            <Text style={styles.confirmLabel}>{t('globalUpload.confirmSave')}</Text>
          )}
        </Pressable>
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.background,
  },
  closeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.original,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 24,
  },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  kindRow: {
    flexDirection: 'row',
    gap: 10,
  },
  kindOption: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  kindOptionSelected: {
    borderColor: colors.original,
    backgroundColor: colors.originalLight,
  },
  kindLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  kindLabelSelected: {
    color: colors.original,
  },
  suggestedBadge: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '700',
    color: colors.original,
    backgroundColor: colors.originalLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  castleList: {
    gap: 8,
  },
  castleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  castleRowSelected: {
    borderColor: colors.original,
    backgroundColor: colors.originalLight,
  },
  castleRowText: {
    flex: 1,
    gap: 2,
  },
  castleName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  castleMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  confirmButton: {
    marginHorizontal: 16,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.original,
  },
  confirmButtonDisabled: {
    opacity: 0.55,
  },
  confirmLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.surface,
  },
  errorText: {
    marginHorizontal: 16,
    marginTop: 10,
    fontSize: 13,
    color: colors.continued,
    lineHeight: 18,
    textAlign: 'center',
  },
});
