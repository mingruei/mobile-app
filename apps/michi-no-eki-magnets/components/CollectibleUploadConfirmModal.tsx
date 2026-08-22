import { useMemo, useState } from 'react';
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
import { useI18n } from '../i18n';
import type { CollectibleKind } from '../types/stationCollectible';
import type { Station } from '../types/station';
import { filterStationsByQuery } from '../utils/stationNameMatching';
import { getDisplayImageUri } from '../utils/collectibleFileIO';

type CollectibleUploadConfirmModalProps = {
  visible: boolean;
  draft: GlobalUploadDraft;
  stations: readonly Station[];
  saving: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onConfirm: (stationId: number, kind: CollectibleKind) => void;
};

export function CollectibleUploadConfirmModal({
  visible,
  draft,
  stations,
  saving,
  errorMessage = null,
  onClose,
  onConfirm,
}: CollectibleUploadConfirmModalProps) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStations = useMemo(() => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      return [];
    }

    return filterStationsByQuery(stations, trimmedQuery).slice(0, 30);
  }, [stations, searchQuery]);

  const canConfirm = selectedStationId != null && !saving;

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
          <Text style={styles.typeValue}>{t('station.magnetUploadTitle')}</Text>
          <Text style={styles.hint}>{t('globalUpload.typeHintMagnet')}</Text>

          <Text style={styles.sectionLabel}>{t('globalUpload.stationLabel')}</Text>
          <Text style={styles.hint}>{t('globalUpload.stationSearchHint')}</Text>

          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('globalUpload.stationSearchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
          />

          <View style={styles.stationList}>
            {filteredStations.map((station) => {
              const selected = selectedStationId === station.id;
              return (
                <Pressable
                  key={station.id}
                  accessibilityRole="button"
                  onPress={() => setSelectedStationId(station.id)}
                  style={[styles.stationRow, selected && styles.stationRowSelected]}
                >
                  <View style={styles.stationRowText}>
                    <Text style={styles.stationName}>{station.name}</Text>
                    <Text style={styles.stationMeta}>{station.location}</Text>
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
            if (selectedStationId != null) {
              onConfirm(selectedStationId, 'magnet');
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
  typeValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
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
  stationList: {
    gap: 8,
  },
  stationRow: {
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
  stationRowSelected: {
    borderColor: colors.original,
    backgroundColor: colors.originalLight,
  },
  stationRowText: {
    flex: 1,
    gap: 2,
  },
  stationName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  stationMeta: {
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
