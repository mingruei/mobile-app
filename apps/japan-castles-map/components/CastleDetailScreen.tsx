import { useCallback, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CheckOption } from '../components/CheckOption';
import { CastleCollectibleUploadSection } from '../components/CastleCollectibleUploadSection';
import { colors } from '../constants/theme';
import { hasCoordinates } from '../i18n/castleContent';
import { useCastleContent } from '../hooks/useCastleContent';
import { useCastleProgress } from '../hooks/useCastleProgress';
import { useMapProvider } from '../hooks/useMapProvider';
import { useI18n } from '../i18n';
import type { Castle } from '../types/castle';
import type { CollectibleKind } from '../types/castleCollectible';
import type { NavigationPoint } from '../types/navigation';
import { formatChineseSubtitleLine } from '../utils/castleDisplayName';
import type { CollectibleUploadSource } from '../utils/castleCollectibleUpload';
import {
  openGoogleMapsTransit,
  openMapsParkingNavigation,
  openMapsParkingSearch,
  openMapsStampLocation,
} from '../utils/maps';

type CastleDetailScreenProps = {
  castle: Castle;
  onBack: () => void;
  onRequestUpload: (kind: CollectibleKind) => void;
  onRegisterUpload: (
    castleId: number,
    kind: CollectibleKind,
    uploadFromSource: (source: CollectibleUploadSource) => Promise<void>,
  ) => void;
};

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.actionButton,
        variant === 'secondary' && styles.actionButtonSecondary,
      ]}
    >
      <Text
        style={[
          styles.actionButtonLabel,
          variant === 'secondary' && styles.actionButtonLabelSecondary,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function NavigationPointRow({
  point,
  actionLabel,
  businessHoursLabel,
  onNavigate,
}: {
  point: NavigationPoint;
  actionLabel: string;
  businessHoursLabel: string;
  onNavigate: () => void;
}) {
  return (
    <View style={styles.pointRow}>
      <Text style={styles.body}>{point.label}</Text>
      {point.businessHours ? (
        <Text style={styles.hours}>
          {businessHoursLabel}：{point.businessHours}
        </Text>
      ) : null}
      {hasCoordinates(point) ? (
        <ActionButton label={actionLabel} variant="secondary" onPress={onNavigate} />
      ) : null}
    </View>
  );
}

export function CastleDetailScreen({
  castle,
  onBack,
  onRequestUpload,
  onRegisterUpload,
}: CastleDetailScreenProps) {
  const { t, getSeriesLabel } = useI18n();
  const { mapProvider } = useMapProvider();
  const content = useCastleContent(castle);
  const { getProgress, toggleProgress } = useCastleProgress();
  const progress = getProgress(castle.id);

  const registerUpload = useCallback(
    (kind: CollectibleKind, uploadFromSource: (source: CollectibleUploadSource) => Promise<void>) => {
      onRegisterUpload(castle.id, kind, uploadFromSource);
    },
    [castle.id, onRegisterUpload],
  );

  const badgeColor =
    castle.series === 'original' ? colors.originalLight : colors.continuedLight;
  const badgeTextColor =
    castle.series === 'original' ? colors.original : colors.continued;
  const chineseSubtitleLine = content.subtitle
    ? formatChineseSubtitleLine(content.subtitle, content.alias)
    : null;
  const hasCastleCardSales = content.castleCardLocations.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backLabel}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.topBarTitle}>
          {t('common.number')} {castle.number}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={[styles.badgeText, { color: badgeTextColor }]}>
            {getSeriesLabel(castle.series, true)}
          </Text>
        </View>

        <Text style={styles.name}>{castle.name}</Text>
        {chineseSubtitleLine ? (
          <Text style={styles.subtitle}>{chineseSubtitleLine}</Text>
        ) : null}

        <Section title={t('castle.progress')}>
          <CheckOption
            label={t('castle.visited')}
            checked={progress.visited}
            onToggle={() => toggleProgress(castle.id, 'visited')}
          />
          <CheckOption
            label={t('castle.meijoStamp')}
            checked={progress.meijoStamp}
            onToggle={() => toggleProgress(castle.id, 'meijoStamp')}
          />
          <CheckOption
            label={t('castle.goshuin')}
            checked={progress.goshuin}
            onToggle={() => toggleProgress(castle.id, 'goshuin')}
          />
          {hasCastleCardSales ? (
            <CheckOption
              label={t('castle.castleCard')}
              checked={progress.castleCard}
              onToggle={() => toggleProgress(castle.id, 'castleCard')}
            />
          ) : null}
        </Section>

        <CastleCollectibleUploadSection
          castleId={castle.id}
          kind="visit-record"
          title={t('castle.visitRecordUploadTitle')}
          storageHint={t('castle.visitRecordUploadHint')}
          onUploadPress={() => onRequestUpload('visit-record')}
          onRegisterUpload={(uploadFromSource) => registerUpload('visit-record', uploadFromSource)}
        />

        <CastleCollectibleUploadSection
          castleId={castle.id}
          kind="meijo-stamp"
          title={t('castle.meijoStampUploadTitle')}
          storageHint={t('castle.meijoStampUploadHint')}
          onUploadPress={() => onRequestUpload('meijo-stamp')}
          onRegisterUpload={(uploadFromSource) => registerUpload('meijo-stamp', uploadFromSource)}
        />

        <CastleCollectibleUploadSection
          castleId={castle.id}
          kind="goshuin"
          title={t('castle.goshuinUploadTitle')}
          onUploadPress={() => onRequestUpload('goshuin')}
          onRegisterUpload={(uploadFromSource) => registerUpload('goshuin', uploadFromSource)}
        />

        {hasCastleCardSales ? (
          <CastleCollectibleUploadSection
            castleId={castle.id}
            kind="castle-card"
            title={t('castle.castleCardUploadTitle')}
            onUploadPress={() => onRequestUpload('castle-card')}
            onRegisterUpload={(uploadFromSource) => registerUpload('castle-card', uploadFromSource)}
          />
        ) : (
          <Section title={t('castle.castleCardUploadTitle')}>
            <Text style={styles.body}>{t('castle.noCastleCardLocation')}</Text>
          </Section>
        )}

        <Section title={t('common.location')}>
          <Text style={styles.body}>{content.locationLabel}</Text>
        </Section>

        <Section title={t('castle.description')}>
          <Text style={styles.body}>{content.description}</Text>
        </Section>

        <Section title={t('castle.stampLocation')}>
          {content.stampLocations.map((point, index) => (
            <NavigationPointRow
              key={`stamp-${point.label}-${index}`}
              point={point}
              actionLabel={t('castle.openStampMap')}
              businessHoursLabel={t('castle.businessHours')}
              onNavigate={() => void openMapsStampLocation(mapProvider, point)}
            />
          ))}
        </Section>

        <Section title={t('castle.castleCardLocation')}>
          {content.castleCardLocations.length > 0 ? (
            content.castleCardLocations.map((point, index) => (
              <NavigationPointRow
                key={`card-${point.label}-${index}`}
                point={point}
                actionLabel={t('castle.openCastleCardMap')}
                businessHoursLabel={t('castle.businessHours')}
                onNavigate={() => void openMapsStampLocation(mapProvider, point)}
              />
            ))
          ) : (
            <Text style={styles.body}>{t('castle.noCastleCardLocation')}</Text>
          )}
        </Section>

        <Section title={t('castle.traffic')}>
          <Text style={styles.subsectionTitle}>{t('castle.drivingLabel')}</Text>
          {content.driving.description ? (
            <Text style={styles.body}>{content.driving.description}</Text>
          ) : null}
          {content.driving.parkingLocations.length > 0 ? (
            content.driving.parkingLocations.map((point, index) => (
              <NavigationPointRow
                key={`${point.label}-${index}`}
                point={point}
                actionLabel={t('castle.drivingNavigation')}
                businessHoursLabel={t('castle.businessHours')}
                onNavigate={() => void openMapsParkingNavigation(mapProvider, point)}
              />
            ))
          ) : (
            <ActionButton
              label={t('castle.parkingNavigation')}
              onPress={() => void openMapsParkingSearch(mapProvider, castle.name)}
            />
          )}

          <Text style={styles.subsectionTitle}>{t('castle.massTransportLabel')}</Text>
          <Text style={styles.body}>{content.publicTransit.description}</Text>
          <ActionButton
            label={t('castle.openTransitMap')}
            variant="secondary"
            onPress={() =>
              void openGoogleMapsTransit(
                mapProvider,
                content.publicTransit.destinationLatitude,
                content.publicTransit.destinationLongitude,
                content.publicTransit.destinationLabel,
              )
            }
          />
        </Section>

        {castle.website ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => Linking.openURL(castle.website!)}
            style={styles.linkButton}
          >
            <Text style={styles.linkLabel}>{t('castle.website')}</Text>
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
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
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
  subsectionTitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  pointRow: {
    gap: 8,
  },
  body: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 23,
  },
  hours: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
  },
  actionButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.original,
  },
  actionButtonSecondary: {
    backgroundColor: colors.originalLight,
  },
  actionButtonLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.surface,
  },
  actionButtonLabelSecondary: {
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
