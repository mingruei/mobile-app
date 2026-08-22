import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { CollectibleUploadConfirmModal } from './CollectibleUploadConfirmModal';
import { CollectibleUploadSourceModal } from './CollectibleUploadSourceModal';
import { colors } from '../constants/theme';
import { useGlobalCollectibleUpload } from '../hooks/useGlobalCollectibleUpload';
import { useI18n } from '../i18n';
import type { Station } from '../types/station';
import {
  isCameraPermissionErrorMessage,
  isMediaPermissionErrorMessage,
} from '../utils/collectibleUploadErrors';

type GlobalCollectibleUploadProps = {
  stations: readonly Station[];
  enabled: boolean;
  onRegisterOpen?: (openSourcePicker: () => void) => void;
};

function getErrorMessage(error: string | null, t: (key: string) => string): string | null {
  if (!error) {
    return null;
  }

  if (isCameraPermissionErrorMessage(error)) {
    return t('station.collectibleCameraPermissionDenied');
  }

  if (isMediaPermissionErrorMessage(error)) {
    return t('station.collectibleMediaPermissionDenied');
  }

  switch (error) {
    case 'global-upload-pdf-not-supported':
      return t('globalUpload.pdfNotSupported');
    case 'global-upload-failed':
      return t('globalUpload.failed');
    case 'Failed to read selected file':
    case 'Failed to write selected file':
    case 'Failed to save collectible':
    case 'Failed to persist upload image':
    case 'picker-timeout':
      return t('globalUpload.failed');
    default:
      return t('globalUpload.failed');
  }
}

export function GlobalCollectibleUploadFab({
  stations,
  enabled: _enabled,
  onRegisterOpen,
}: GlobalCollectibleUploadProps) {
  const { t } = useI18n();
  const {
    phase,
    draft,
    error,
    openSourcePicker,
    closeFlow,
    selectSource,
    confirmUpload,
  } = useGlobalCollectibleUpload();

  useEffect(() => {
    onRegisterOpen?.(openSourcePicker);
  }, [onRegisterOpen, openSourcePicker]);

  const errorMessage = getErrorMessage(error, t);
  const isConfirmPhase = phase === 'confirm' || phase === 'saving';
  const showSourcePicker = phase === 'source-picker';
  const isPicking = phase === 'picking';

  return (
    <>
      {isPicking ? (
        <View pointerEvents="none" style={styles.pickingOverlay}>
          <ActivityIndicator size="large" color={colors.surface} />
        </View>
      ) : null}

      <CollectibleUploadSourceModal
        visible={showSourcePicker}
        title={t('globalUpload.chooseSource')}
        errorMessage={errorMessage}
        onClose={closeFlow}
        onSelect={(source) => void selectSource(source)}
      />

      {draft ? (
        <CollectibleUploadConfirmModal
          key={draft.selection.uri}
          visible={isConfirmPhase}
          draft={draft}
          stations={stations}
          saving={phase === 'saving'}
          errorMessage={errorMessage}
          onClose={closeFlow}
          onConfirm={(stationId, kind) => void confirmUpload(stationId, kind)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  pickingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
});
