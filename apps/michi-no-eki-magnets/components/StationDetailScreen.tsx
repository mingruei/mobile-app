import { useCallback } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CheckOption } from '../components/CheckOption';
import { StationCollectibleUploadSection } from '../components/StationCollectibleUploadSection';
import { StationServicesSection } from '../components/StationServicesSection';
import { colors } from '../constants/theme';
import { useStationProgress } from '../hooks/useStationProgress';
import { useMapProvider } from '../hooks/useMapProvider';
import { useI18n } from '../i18n';
import type { Station } from '../types/station';
import type { CollectibleKind } from '../types/stationCollectible';
import type { CollectibleUploadSource } from '../utils/stationCollectibleUpload';
import { openMapsStampLocation } from '../utils/maps';

type StationDetailScreenProps = {
  station: Station;
  onBack: () => void;
  onRequestUpload: (kind: CollectibleKind) => void;
  onRegisterUpload: (
    stationId: number,
    kind: CollectibleKind,
    uploadFromSource: (source: CollectibleUploadSource) => Promise<void>,
  ) => void;
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function StationDetailScreen({
  station,
  onBack,
  onRequestUpload,
  onRegisterUpload,
}: StationDetailScreenProps) {
  const { t } = useI18n();
  const { mapProvider } = useMapProvider();
  const { getProgress, toggleProgress } = useStationProgress();
  const progress = getProgress(station.id);

  const registerUpload = useCallback(
    (kind: CollectibleKind, uploadFromSource: (source: CollectibleUploadSource) => Promise<void>) => {
      onRegisterUpload(station.id, kind, uploadFromSource);
    },
    [station.id, onRegisterUpload],
  );

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backLabel}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {station.name}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.name}>{station.name}</Text>
        {station.nameEn ? <Text style={styles.subtitle}>{station.nameEn}</Text> : null}

        <Section title={t('station.progress')}>
          <CheckOption
            label={t('station.visited')}
            checked={progress.visited}
            onToggle={() => toggleProgress(station.id, 'visited')}
          />
          <CheckOption
            label={t('station.magnet')}
            checked={progress.magnet}
            disabled={progress.magnetNotSold}
            onToggle={() => toggleProgress(station.id, 'magnet')}
          />
          <CheckOption
            label={t('station.magnetNotSold')}
            checked={progress.magnetNotSold}
            onToggle={() => toggleProgress(station.id, 'magnetNotSold')}
          />
        </Section>

        <StationCollectibleUploadSection
          stationId={station.id}
          kind="magnet"
          title={t('station.magnetUploadTitle')}
          storageHint={t('station.magnetUploadHint')}
          onUploadPress={() => onRequestUpload('magnet')}
          onRegisterUpload={(uploadFromSource) => registerUpload('magnet', uploadFromSource)}
        />

        <StationServicesSection services={station.services} />

        <Section title={t('common.location')}>
          <Text style={styles.body}>{station.location}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              void openMapsStampLocation(mapProvider, {
                label: station.name,
                googleLabel: station.location,
                latitude: station.latitude,
                longitude: station.longitude,
              })
            }
            style={styles.navButton}
          >
            <Text style={styles.navButtonLabel}>{t('station.openMap')}</Text>
          </Pressable>
        </Section>

        {station.shortDescription ? (
          <Section title={t('station.description')}>
            <Text style={styles.body}>{station.shortDescription}</Text>
          </Section>
        ) : null}

        {station.website ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => Linking.openURL(station.website!)}
            style={styles.linkButton}
          >
            <Text style={styles.linkLabel}>{t('station.website')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.background,
  },
  backLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.original,
  },
  topBarTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMuted,
  },
  content: {
    padding: 20,
    gap: 18,
    paddingBottom: 32,
  },
  name: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 34,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 16,
    color: colors.textMuted,
  },
  section: {
    gap: 10,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  body: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 23,
  },
  navButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.originalLight,
  },
  navButtonLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.original,
  },
  linkButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.originalLight,
  },
  linkLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.original,
  },
});
