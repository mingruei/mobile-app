import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../constants/theme';
import { useStationData } from '../hooks/useStationData';
import { useStationGroups } from '../hooks/useStationGroups';
import { useStationProgress } from '../hooks/useStationProgress';
import { useMapProvider } from '../hooks/useMapProvider';
import { useI18n } from '../i18n';
import type { MapProvider } from '../types/mapProvider';
import type { CollectibleImportMode } from '../types/collectibleBackup';
import { getAppVersionInfo } from '../utils/appVersion';
import { FEEDBACK_EMAIL, openFeedbackEmail } from '../utils/openFeedbackEmail';
import { TipJarSection } from './TipJarSection';

type SettingsScreenProps = {
  onBack: () => void;
};

type CollectibleImportPhase = 'preparing' | 'choosing-mode' | 'processing';

function waitForProcessingOverlay(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(resolve, Platform.OS === 'android' ? 100 : 50);
      });
    });
  });
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { t } = useI18n();
  const { mapProvider, setMapProvider } = useMapProvider();
  const { reloadProgressMap } = useStationProgress();
  const { reloadGroups } = useStationGroups();
  const {
    version: stationDataVersion,
    updatedAt: stationDataUpdatedAt,
    source: stationDataSource,
    bundledVersion,
    remoteSyncConfigured,
    ready: stationDataReady,
  } = useStationData();
  const [exportingCollectibles, setExportingCollectibles] = useState(false);
  const [importPhase, setImportPhase] = useState<CollectibleImportPhase | null>(null);
  const [pendingImportUri, setPendingImportUri] = useState<string | null>(null);
  const [selectedImportMode, setSelectedImportMode] = useState<CollectibleImportMode>('merge-newer');
  const [collectibleMessage, setCollectibleMessage] = useState<string | null>(null);
  const [collectibleError, setCollectibleError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    void import('../utils/collectibleBackup');
  }, []);

  const isImportBusy = importPhase !== null;

  const resolveCollectibleError = useCallback(
    (error: unknown, mode: 'export' | 'import'): string => {
      const code = error instanceof Error ? error.message : '';

      switch (code) {
        case 'collectible-backup-nothing-to-export':
          return t('settings.collectibleBackupNothingToExport');
        case 'collectible-backup-import-nothing-new':
          return t('settings.collectibleBackupImportNothingNew');
        case 'collectible-backup-invalid-manifest':
        case 'collectible-backup-invalid-progress':
        case 'collectible-backup-invalid-groups':
        case 'collectible-backup-unsupported-version':
        case 'collectible-backup-empty-archive':
        case 'collectible-backup-invalid-archive':
          return t('settings.collectibleBackupInvalidArchive');
        case 'collectible-backup-share-unavailable':
          return t('settings.collectibleBackupShareUnavailable');
        case 'collectible-backup-export-failed':
          return t('settings.collectibleBackupExportFailed');
        case 'collectible-backup-read-failed':
          return t('settings.collectibleBackupReadFailed');
        case 'Failed to read selected file':
        case 'Failed to write selected file':
          return t('settings.collectibleBackupReadFailed');
        default:
          return mode === 'export'
            ? t('settings.collectibleBackupExportFailed')
            : t('settings.collectibleBackupImportFailed');
      }
    },
    [t],
  );

  const handleFeedbackEmailPress = useCallback(async () => {
    setFeedbackMessage(null);

    const result = await openFeedbackEmail();
    if (result === 'unavailable') {
      setFeedbackMessage(t('settings.feedbackUnavailable'));
    }
  }, [t]);

  const handleExportCollectibles = async () => {
    setCollectibleMessage(null);
    setCollectibleError(null);
    setExportingCollectibles(true);
    await waitForProcessingOverlay();

    try {
      const { exportCollectibleArchive } = await import('../utils/collectibleBackup');
      const result = await exportCollectibleArchive();
      setCollectibleMessage(
        t('settings.collectibleExportSuccess', {
          files: result.fileCount,
          progress: result.progressStations,
          groups: result.groupCount,
        }),
      );
    } catch (error) {
      setCollectibleError(resolveCollectibleError(error, 'export'));
    } finally {
      setExportingCollectibles(false);
    }
  };

  const handleImportCollectibles = async () => {
    setCollectibleMessage(null);
    setCollectibleError(null);
    setImportPhase('preparing');
    await waitForProcessingOverlay();

    try {
      const { pickCollectibleArchive } = await import('../utils/collectibleBackup');
      const sourceUri = await pickCollectibleArchive();
      if (!sourceUri) {
        setImportPhase(null);
        return;
      }

      setPendingImportUri(sourceUri);
      setSelectedImportMode('merge-newer');
      setImportPhase('choosing-mode');
    } catch (error) {
      setCollectibleError(resolveCollectibleError(error, 'import'));
      setImportPhase(null);
    }
  };

  const handleCancelImportMode = () => {
    setPendingImportUri(null);
    setImportPhase(null);
  };

  const handleConfirmImport = async () => {
    if (!pendingImportUri) {
      return;
    }

    setImportPhase('processing');
    await waitForProcessingOverlay();

    try {
      const { processCollectibleImport } = await import('../utils/collectibleBackup');
      const result = await processCollectibleImport(pendingImportUri, selectedImportMode);
      await reloadProgressMap();
      await reloadGroups();
      setCollectibleMessage(
        t('settings.collectibleImportSuccess', {
          imported: result.imported,
          skipped: result.skipped,
          progress: result.progressMerged,
          groups: result.groupsMerged,
        }),
      );
    } catch (error) {
      setCollectibleError(resolveCollectibleError(error, 'import'));
    } finally {
      setPendingImportUri(null);
      setImportPhase(null);
    }
  };

  const importModeOptions: {
    id: CollectibleImportMode;
    titleKey: 'settings.collectibleImportModeReplace' | 'settings.collectibleImportModeMergeNewer';
    hintKey:
      | 'settings.collectibleImportModeReplaceHint'
      | 'settings.collectibleImportModeMergeNewerHint';
  }[] = [
    {
      id: 'replace',
      titleKey: 'settings.collectibleImportModeReplace',
      hintKey: 'settings.collectibleImportModeReplaceHint',
    },
    {
      id: 'merge-newer',
      titleKey: 'settings.collectibleImportModeMergeNewer',
      hintKey: 'settings.collectibleImportModeMergeNewerHint',
    },
  ];

  const mapProviderOptions: { id: MapProvider; labelKey: 'settings.mapProviderApple' | 'settings.mapProviderGoogle' }[] = [
    { id: 'apple', labelKey: 'settings.mapProviderApple' },
    { id: 'google', labelKey: 'settings.mapProviderGoogle' },
  ];

  const appVersion = getAppVersionInfo();

  const stationDataSourceLabel =
    stationDataSource === 'remote'
      ? t('settings.stationDataSourceRemote')
      : stationDataSource === 'cache'
        ? t('settings.stationDataSourceCache')
        : t('settings.stationDataSourceBundled');

  const formattedStationDataUpdatedAt = (() => {
    const parsed = Date.parse(stationDataUpdatedAt);
    if (Number.isNaN(parsed)) {
      return stationDataUpdatedAt;
    }

    return new Date(parsed).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  })();

  return (
    <View style={styles.container}>
      <Modal
        visible={exportingCollectibles || importPhase === 'preparing' || importPhase === 'processing'}
        transparent
        animationType="fade"
        onRequestClose={() => undefined}
      >
        <View style={styles.processingOverlay}>
          <View style={styles.processingCard}>
            <ActivityIndicator size="large" color={colors.original} />
            <Text style={styles.processingTitle}>
              {importPhase === 'preparing'
                ? t('settings.collectibleSelectingArchive')
                : importPhase === 'processing'
                  ? t('settings.collectibleImporting')
                  : t('settings.collectibleExporting')}
            </Text>
            <Text style={styles.processingHint}>
              {importPhase === 'preparing'
                ? t('settings.collectibleSelectingArchiveHint')
                : importPhase === 'processing'
                  ? t('settings.collectibleProcessingImportHint')
                  : t('settings.collectibleProcessingExportHint')}
            </Text>
          </View>
        </View>
      </Modal>

      <Modal
        visible={importPhase === 'choosing-mode'}
        transparent
        animationType="fade"
        onRequestClose={handleCancelImportMode}
      >
        <View style={styles.processingOverlay}>
          <View style={styles.importModeCard}>
            <Text style={styles.processingTitle}>{t('settings.collectibleImportModeTitle')}</Text>
            <Text style={styles.processingHint}>{t('settings.collectibleImportModeHint')}</Text>

            <View style={styles.importModeOptionGroup}>
              {importModeOptions.map((option) => {
                const selected = selectedImportMode === option.id;
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedImportMode(option.id)}
                    style={[styles.importModeOption, selected && styles.importModeOptionSelected]}
                  >
                    <View style={styles.importModeOptionHeader}>
                      <View
                        style={[
                          styles.optionIndicator,
                          selected && styles.optionIndicatorSelected,
                        ]}
                      />
                      <Text style={styles.importModeOptionTitle}>{t(option.titleKey)}</Text>
                    </View>
                    <Text style={styles.importModeOptionHint}>{t(option.hintKey)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.importModeActions}>
              <Pressable
                accessibilityRole="button"
                onPress={handleCancelImportMode}
                style={styles.importModeCancelButton}
              >
                <Text style={styles.importModeCancelLabel}>
                  {t('settings.collectibleImportModeCancel')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => void handleConfirmImport()}
                style={[styles.primaryButton, styles.importModeConfirmButton]}
              >
                <Text style={styles.primaryButtonLabel}>
                  {t('settings.collectibleImportModeConfirm')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backLabel}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('settings.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {Platform.OS === 'ios' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('settings.mapProvider')}</Text>
            <Text style={styles.rowHint}>{t('settings.mapProviderHint')}</Text>
            <View style={styles.optionGroup}>
              {mapProviderOptions.map((option) => {
                const selected = mapProvider === option.id;
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => void setMapProvider(option.id)}
                    style={[styles.optionRow, selected && styles.optionRowSelected]}
                  >
                    <View style={[styles.optionIndicator, selected && styles.optionIndicatorSelected]} />
                    <Text style={styles.optionLabel}>{t(option.labelKey)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('settings.collectibleBackup')}</Text>
          <Text style={styles.rowHint}>{t('settings.collectibleBackupHint')}</Text>

          <View style={styles.backupButtonRow}>
            <Pressable
              accessibilityRole="button"
              disabled={exportingCollectibles || isImportBusy}
              onPress={() => void handleExportCollectibles()}
              style={[
                styles.primaryButton,
                styles.backupButton,
                (exportingCollectibles || isImportBusy) && styles.buttonDisabled,
              ]}
            >
              {exportingCollectibles ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <Text style={styles.primaryButtonLabel}>{t('settings.collectibleExport')}</Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={exportingCollectibles || isImportBusy}
              onPress={() => void handleImportCollectibles()}
              style={[
                styles.secondaryActionButton,
                (exportingCollectibles || isImportBusy) && styles.buttonDisabled,
              ]}
            >
              {isImportBusy ? (
                <ActivityIndicator size="small" color={colors.original} />
              ) : (
                <Text style={styles.secondaryActionButtonLabel}>{t('settings.collectibleImport')}</Text>
              )}
            </Pressable>
          </View>

          {exportingCollectibles ? (
            <Text style={styles.syncText}>{t('settings.collectibleExporting')}</Text>
          ) : null}
          {isImportBusy ? (
            <Text style={styles.syncText}>
              {importPhase === 'preparing'
                ? t('settings.collectibleSelectingArchive')
                : t('settings.collectibleImporting')}
            </Text>
          ) : null}
          {collectibleMessage ? <Text style={styles.successText}>{collectibleMessage}</Text> : null}
          {collectibleError ? <Text style={styles.errorText}>{collectibleError}</Text> : null}
        </View>

        <TipJarSection />

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('settings.stationData')}</Text>
          <Text style={styles.rowHint}>{t('settings.stationDataHint')}</Text>
          {stationDataReady ? (
            <>
              <Text style={styles.versionValue}>
                {t('settings.stationDataVersionValue', {
                  version: stationDataVersion,
                  source: stationDataSourceLabel,
                })}
              </Text>
              <Text style={styles.rowHint}>
                {t('settings.stationDataUpdatedAtValue', {
                  updatedAt: formattedStationDataUpdatedAt,
                })}
              </Text>
              <Text style={styles.rowHint}>
                {t('settings.stationDataBundledVersionValue', {
                  version: bundledVersion,
                })}
              </Text>
              <Text style={styles.rowHint}>
                {remoteSyncConfigured
                  ? t('settings.stationDataRemoteSyncEnabled')
                  : t('settings.stationDataRemoteSyncDisabled')}
              </Text>
            </>
          ) : (
            <ActivityIndicator size="small" color={colors.original} />
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('settings.feedback')}</Text>
          <Text style={styles.rowHint}>{t('settings.feedbackHint')}</Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => void handleFeedbackEmailPress()}
            style={styles.feedbackLink}
          >
            <Text style={styles.feedbackEmail}>{FEEDBACK_EMAIL}</Text>
          </Pressable>
          {feedbackMessage ? <Text style={styles.successText}>{feedbackMessage}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('settings.version')}</Text>
          <Text style={styles.versionValue}>
            {t('settings.versionValue', {
              version: appVersion.version,
              build: appVersion.build,
            })}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  processingOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    padding: 24,
  },
  processingCard: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  importModeCard: {
    width: '100%',
    maxWidth: 360,
    gap: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  importModeOptionGroup: {
    gap: 10,
  },
  importModeOption: {
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  importModeOptionSelected: {
    borderColor: colors.original,
    backgroundColor: colors.originalLight,
  },
  importModeOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  importModeOptionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  importModeOptionHint: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    paddingLeft: 28,
  },
  importModeActions: {
    flexDirection: 'row',
    gap: 12,
  },
  importModeCancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.originalLight,
    paddingHorizontal: 16,
  },
  importModeCancelLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.original,
  },
  importModeConfirmButton: {
    flex: 1,
  },
  processingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  processingHint: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  backLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.original,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  rowHint: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.original,
    paddingHorizontal: 16,
  },
  primaryButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.surface,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  backupButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  backupButton: {
    flex: 1,
  },
  secondaryActionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.originalLight,
    paddingHorizontal: 16,
  },
  secondaryActionButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.original,
  },
  successText: {
    fontSize: 13,
    color: colors.original,
    lineHeight: 18,
  },
  syncText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  errorText: {
    fontSize: 13,
    color: colors.continued,
    lineHeight: 18,
  },
  versionValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  feedbackLink: {
    alignSelf: 'flex-start',
  },
  feedbackEmail: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.original,
    lineHeight: 22,
  },
  optionGroup: {
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  optionRowSelected: {
    borderColor: colors.original,
    backgroundColor: colors.originalLight,
  },
  optionIndicator: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionIndicatorSelected: {
    borderColor: colors.original,
    backgroundColor: colors.original,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
});
