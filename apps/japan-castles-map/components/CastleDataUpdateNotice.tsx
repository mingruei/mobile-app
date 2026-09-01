import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/theme';

type CastleDataUpdateNoticeProps = {
  visible: boolean;
  message: string;
  onDismiss: () => void;
};

export function CastleDataUpdateNotice({
  visible,
  message,
  onDismiss,
}: CastleDataUpdateNoticeProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={message}
        onPress={onDismiss}
        style={styles.backdrop}
      >
        <View style={styles.card} pointerEvents="none">
          <Text style={styles.message}>{message}</Text>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  message: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 24,
  },
});
