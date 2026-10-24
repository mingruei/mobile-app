import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

type Props = {
  title: string;
  subtitle: string;
  onPress: () => void;
};

export function MiniPlayer({ title, subtitle, onPress }: Props) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.bar}>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {subtitle}
        </Text>
      </View>
      <Text style={styles.open} maxFontSizeMultiplier={1.2}>
        打開
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: colors.ink,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: '#F3EFE6',
    fontSize: fonts.meta,
  },
  open: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
});
