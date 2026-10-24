import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  color?: string;
  textColor?: string;
};

export function BigButton({
  label,
  onPress,
  color = colors.blue,
  textColor = '#fff',
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: color, opacity: pressed ? 0.88 : 1 }]}
    >
      <Text
        style={[styles.label, { color: textColor }]}
        maxFontSizeMultiplier={1.15}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  label: {
    fontSize: fonts.button,
    fontWeight: '800',
  },
});
