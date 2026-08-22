import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/theme';
import { useTipJar } from '../hooks/useTipJar';
import { useI18n } from '../i18n';

export function TipJarSection() {
  const { t } = useI18n();
  const { connected, tipProduct, purchaseTip, status, isPurchasing } = useTipJar();

  const buttonLabel = tipProduct?.displayPrice ?? t('settings.tipJarButtonFallback');
  const isDisabled = !connected || isPurchasing || (!tipProduct && connected);

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{t('settings.tipJarTitle')}</Text>
      <Text style={styles.rowHint}>{t('settings.tipJarHint')}</Text>

      <Pressable
        accessibilityRole="button"
        disabled={isDisabled}
        onPress={() => void purchaseTip()}
        style={[styles.primaryButton, isDisabled && styles.buttonDisabled]}
      >
        {isPurchasing ? (
          <ActivityIndicator size="small" color={colors.surface} />
        ) : (
          <Text style={styles.primaryButtonLabel}>{buttonLabel}</Text>
        )}
      </Pressable>

      {!tipProduct && connected ? (
        <Text style={styles.rowHint}>{t('settings.tipJarUnavailable')}</Text>
      ) : null}
      {status === 'thanks' ? <Text style={styles.successText}>{t('settings.tipJarThanks')}</Text> : null}
      {status === 'error' ? <Text style={styles.errorText}>{t('settings.tipJarFailed')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  successText: {
    fontSize: 13,
    color: colors.original,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 13,
    color: colors.continued,
    lineHeight: 18,
  },
});
