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
import { useDynamicTypeLayout } from '../hooks/useDynamicTypeLayout';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useStationGroups } from '../hooks/useStationGroups';
import { useStationProgress } from '../hooks/useStationProgress';
import { useI18n } from '../i18n';
import type { CollectibleImportMode } from '../types/collectibleBackup';
import { getAppVersionInfo } from '../utils/appVersion';
import { FEEDBACK_EMAIL, openFeedbackEmail } from '../utils/openFeedbackEmail';
import { preloadCollectibleBackup } from '../utils/preloadCollectibleBackup';
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
  const { minTouchTarget, isLargeContentSize } = useDynamicTypeLayout();
  const reduceMotionEnabled = useReduceMotion();
  const { reloadProgressMap } = useStationProgress();
  const { reloadGroups } = useStationGroups();
  const [exportingCollectibles, setExportingCollectibles] = useState(false);
  const [importPhase, setImportPhase] = useState<CollectibleImportPhase | null>(null);
  const [pendingImportUri, setPendingImportUri] = useState<string | null>(null);
  const [selectedImportMode, setSelectedImportMode] = useState<CollectibleImportMode>('merge-newer');
  const [collectibleMessage, setCollectibleMessage] = useState<string | null>(null);
  const [collectibleError, setCollectibleError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    preloadCollectibleBackup();
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

  const appVersion = getAppVersionInfo();

  return (
    <View style={styles.container}>
      <Modal
        visible={exportingCollectibles || importPhase === 'preparing' || importPhase === 'processing'}
        transparent
        animationType={reduceMotionEnabled ? 'none' : 'fade'}
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
        animationType={reduceMotionEnabled ? 'none' : 'fade'}
        onRequestClose={handleCancelImportMode}
      >
        <View style={styles.processingOverlay}>
          <View style={styles.importModeCard}>
            <Text style={styles.processingTitle}>{t('settings.collectibleImportModeTitle')}</Text>
            <Text style={styles.processingHint}>{t('settings.collectibleImportModeHint')}</Text>

            <View style={styles.importModeOptionGroup}>
              {importModeOptions.map((option) => {
                const selected = selectedImportMode === option.id;
                const optionTitle = t(option.titleKey);
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="radio"
                    accessibilityLabel={
                      selected ? `${optionTitle}，${t('common.selected')}` : optionTitle
                    }
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedImportMode(option.id)}
                    style={[
                      styles.importModeOption,
                      selected && styles.importModeOptionSelected,
                    ]}
                  >
                    <View
                      style={[
                        styles.importModeOptionHeader,
                        isLargeContentSize && styles.importModeOptionHeaderLarge,
                      ]}
                    >
                      <View
                        style={[
                          styles.optionIndicator,
                          selected && styles.optionIndicatorSelected,
                        ]}
                      />
                      <Text
                        style={[
                          styles.importModeOptionTitle,
                          selected && styles.importModeOptionTitleSelected,
                        ]}
                      >
                        {selected ? `✓ ${optionTitle}` : optionTitle}
                      </Text>
                    </View>
                    <Text style={styles.importModeOptionHint}>{t(option.hintKey)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View
              style={[
                styles.importModeActions,
                isLargeContentSize && styles.importModeActionsLarge,
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('settings.collectibleImportModeCancel')}
                onPress={handleCancelImportMode}
                style={[styles.importModeCancelButton, { minHeight: minTouchTarget }]}
              >
                <Text style={styles.importModeCancelLabel}>
                  {t('settings.collectibleImportModeCancel')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('settings.collectibleImportModeConfirm')}
                onPress={() => void handleConfirmImport()}
                style={[
                  styles.primaryButton,
                  styles.importModeConfirmButton,
                  { minHeight: minTouchTarget },
                ]}
              >
                <Text style={styles.primaryButtonLabel}>
                  {t('settings.collectibleImportModeConfirm')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={[styles.header, isLargeContentSize && styles.headerLarge]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={onBack}
          style={[styles.backButton, { minHeight: minTouchTarget }]}
        >
          <Text style={styles.backLabel}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={2}>
          {t('settings.title')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('settings.collectibleBackup')}</Text>
          <Text style={styles.rowHint}>{t('settings.collectibleBackupHint')}</Text>

          <View style={[styles.backupButtonRow, isLargeContentSize && styles.backupButtonRowLarge]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('settings.collectibleExport')}
              accessibilityState={{ disabled: exportingCollectibles || isImportBusy, busy: exportingCollectibles }}
              disabled={exportingCollectibles || isImportBusy}
              onPress={() => void handleExportCollectibles()}
              style={[
                styles.primaryButton,
                styles.backupButton,
                { minHeight: minTouchTarget },
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
              accessibilityLabel={t('settings.collectibleImport')}
              accessibilityState={{ disabled: exportingCollectibles || isImportBusy, busy: isImportBusy }}
              disabled={exportingCollectibles || isImportBusy}
              onPress={() => void handleImportCollectibles()}
              style={[
                styles.secondaryActionButton,
                { minHeight: minTouchTarget },
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
          <Text style={styles.sectionTitle}>{t('settings.feedback')}</Text>
          <Text style={styles.rowHint}>{t('settings.feedbackHint')}</Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={FEEDBACK_EMAIL}
            onPress={() => void handleFeedbackEmailPress()}
            style={[styles.feedbackLink, { minHeight: minTouchTarget }]}
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
  importModeOptionHeaderLarge: {
    alignItems: 'flex-start',
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
  importModeOptionTitle: {
    flex: 1,
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  importModeOptionTitleSelected: {
    color: colors.originalSelectedText,
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
  importModeActionsLarge: {
    flexWrap: 'wrap',
  },
  importModeCancelButton: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.originalLight,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  headerLarge: {
    alignItems: 'flex-start',
    flexWrap: 'wrap',
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
    flex: 1,
    flexShrink: 1,
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
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.original,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.surface,
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  backupButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  backupButtonRowLarge: {
    flexWrap: 'wrap',
  },
  backupButton: {
    flex: 1,
    minWidth: 120,
  },
  secondaryActionButton: {
    flex: 1,
    minWidth: 120,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.originalLight,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryActionButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.original,
    textAlign: 'center',
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
    justifyContent: 'center',
    paddingVertical: 4,
  },
  feedbackEmail: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.original,
    lineHeight: 22,
    flexShrink: 1,
  },
});
