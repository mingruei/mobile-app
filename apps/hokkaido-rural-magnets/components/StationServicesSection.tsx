import { StyleSheet, Text, View } from 'react-native';

import { STATION_SERVICE_IDS, type StationServiceId } from '../constants/stationServices';
import { colors } from '../constants/theme';
import { useI18n } from '../i18n';

type StationServicesSectionProps = {
  services: readonly StationServiceId[];
};

export function StationServicesSection({ services }: StationServicesSectionProps) {
  const { t, getStationServiceLabel } = useI18n();
  const available = new Set(services);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('station.services')}</Text>
      <View style={styles.grid}>
        {STATION_SERVICE_IDS.map((serviceId) => {
          const enabled = available.has(serviceId);
          return (
            <View
              key={serviceId}
              style={[styles.chip, enabled ? styles.chipEnabled : styles.chipDisabled]}
            >
              <Text style={[styles.chipText, enabled ? styles.chipTextEnabled : styles.chipTextDisabled]}>
                {getStationServiceLabel(serviceId)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipEnabled: {
    borderColor: colors.original,
    backgroundColor: colors.originalLight,
  },
  chipDisabled: {
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextEnabled: {
    color: colors.original,
  },
  chipTextDisabled: {
    color: colors.textMuted,
  },
});
