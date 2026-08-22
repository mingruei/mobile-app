import { Modal, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../constants/theme';
import { useI18n } from '../i18n';
import type { CollectibleUploadSource } from '../utils/stationCollectibleUpload';
import { DEFAULT_COLLECTIBLE_UPLOAD_SOURCES } from '../utils/stationCollectibleUpload';

type CollectibleUploadSourceModalProps = {
  visible: boolean;
  title?: string;
  errorMessage?: string | null;
  sources?: readonly CollectibleUploadSource[];
  onClose: () => void;
  onSelect: (source: CollectibleUploadSource) => void;
};

function getUploadSourceLabel(
  source: CollectibleUploadSource,
  t: (key: string) => string,
): string {
  switch (source) {
    case 'scan':
      return t('station.collectibleScan');
    case 'file':
      return t('station.collectibleUploadFile');
    case 'gallery':
      return t('station.collectiblePhotoLibrary');
    case 'camera':
      return t('station.collectibleCamera');
  }
}

export function CollectibleUploadSourceModal({
  visible,
  title,
  errorMessage = null,
  sources = DEFAULT_COLLECTIBLE_UPLOAD_SOURCES,
  onClose,
  onSelect,
}: CollectibleUploadSourceModalProps) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'android' ? Math.max(insets.bottom, 16) : insets.bottom;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.modalBackdrop, { paddingBottom: 16 + bottomInset }]}
        onPress={onClose}
      >
        <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.modalTitle}>{title ?? t('station.collectibleChooseSource')}</Text>
          {sources.map((source) => (
            <Pressable
              key={source}
              accessibilityRole="button"
              onPress={() => onSelect(source)}
              style={styles.modalOption}
            >
              <Text style={styles.modalOptionLabel}>{getUploadSourceLabel(source, t)}</Text>
            </Pressable>
          ))}
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalCancel}>
            <Text style={styles.modalCancelLabel}>{t('common.close')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  modalCard: {
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  modalOption: {
    borderRadius: 12,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  modalOptionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  modalCancel: {
    marginTop: 4,
    alignItems: 'center',
    paddingVertical: 12,
  },
  modalCancelLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.original,
  },
  errorText: {
    fontSize: 13,
    color: colors.continued,
    lineHeight: 18,
  },
});
