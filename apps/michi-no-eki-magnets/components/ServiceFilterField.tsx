import { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { STATION_SERVICE_IDS, type StationServiceId } from '../constants/stationServices';
import { colors } from '../constants/theme';
import { useI18n } from '../i18n';

type ServiceFilterFieldProps = {
  selectedServices: readonly StationServiceId[];
  onChange: (services: StationServiceId[]) => void;
};

export function ServiceFilterField({ selectedServices, onChange }: ServiceFilterFieldProps) {
  const { t, getStationServiceLabel } = useI18n();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState<StationServiceId[]>([...selectedServices]);

  const fieldLabel = useMemo(() => {
    if (selectedServices.length === 0) {
      return t('common.all');
    }

    if (selectedServices.length === 1) {
      return getStationServiceLabel(selectedServices[0]);
    }

    return t('filter.servicesSelectedCount', { count: selectedServices.length });
  }, [getStationServiceLabel, selectedServices, t]);

  const openModal = () => {
    setDraft([...selectedServices]);
    setVisible(true);
  };

  const toggleService = (serviceId: StationServiceId) => {
    setDraft((current) =>
      current.includes(serviceId)
        ? current.filter((item) => item !== serviceId)
        : [...current, serviceId],
    );
  };

  const bottomInset = Platform.OS === 'android' ? Math.max(insets.bottom, 16) : insets.bottom;

  return (
    <>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{t('filter.services')}</Text>
        <Pressable accessibilityRole="button" onPress={openModal} style={styles.fieldButton}>
          <Text style={styles.fieldValue} numberOfLines={1}>
            {fieldLabel}
          </Text>
          <Text style={styles.fieldChevron}>▼</Text>
        </Pressable>
      </View>

      <Modal animationType="slide" transparent visible={visible} onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setVisible(false)}>
          <Pressable
            style={[styles.modalSheet, { paddingBottom: bottomInset }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('filter.selectServices')}</Text>
              <Pressable accessibilityRole="button" onPress={() => setVisible(false)}>
                <Text style={styles.modalClose}>{t('common.close')}</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalList}
              contentContainerStyle={{ paddingBottom: bottomInset > 0 ? 8 : 16 }}
            >
              {STATION_SERVICE_IDS.map((serviceId) => {
                const selected = draft.includes(serviceId);
                return (
                  <Pressable
                    key={serviceId}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    onPress={() => toggleService(serviceId)}
                    style={[styles.modalOption, selected && styles.modalOptionSelected]}
                  >
                    <Text
                      style={[styles.modalOptionText, selected && styles.modalOptionTextSelected]}
                    >
                      {getStationServiceLabel(serviceId)}
                    </Text>
                    <Text style={[styles.checkmark, selected && styles.checkmarkSelected]}>
                      {selected ? '✓' : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setDraft([])}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonLabel}>{t('filter.servicesClear')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onChange([...draft]);
                  setVisible(false);
                }}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonLabel}>{t('filter.servicesDone')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  fieldButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  fieldValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  fieldChevron: {
    marginLeft: 8,
    fontSize: 12,
    color: colors.textMuted,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  modalSheet: {
    maxHeight: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.surface,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalClose: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.original,
  },
  modalList: {
    maxHeight: 420,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalOptionSelected: {
    backgroundColor: colors.originalLight,
  },
  modalOptionText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  modalOptionTextSelected: {
    fontWeight: '700',
    color: colors.original,
  },
  checkmark: {
    width: 24,
    textAlign: 'right',
    fontSize: 16,
    fontWeight: '800',
    color: colors.textMuted,
  },
  checkmarkSelected: {
    color: colors.original,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  secondaryButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.original,
  },
  primaryButtonLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.surface,
  },
});
