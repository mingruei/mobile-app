import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BigButton } from './BigButton';
import { colors, fonts } from '../theme';

export type ContinueCard = {
  showTitle: string;
  episodeTitle: string;
  positionLabel: string;
  onDevice: boolean;
  onPress: () => void;
};

export type ShowCard = {
  id: string;
  title: string;
  author: string;
};

type Props = {
  continueListening: ContinueCard | null;
  shows: ShowCard[];
  onOpenShow: (showId: string) => void;
  onAdd: () => void;
};

export function HomeScreen({ continueListening, shows, onOpenShow, onAdd }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <Text style={styles.title} maxFontSizeMultiplier={1.2}>
          AudioFlow
        </Text>
        <Text style={styles.zhName} maxFontSizeMultiplier={1.2}>
          奧笛流
        </Text>
      </View>
      <Text style={styles.lead} maxFontSizeMultiplier={1.3}>
        整集存在這支手機。隔天打開，從上次的地方接著聽。
      </Text>

      {continueListening ? (
        <Pressable accessibilityRole="button" onPress={continueListening.onPress} style={styles.continue}>
          <Text style={styles.kicker} maxFontSizeMultiplier={1.2}>
            接著聽
          </Text>
          <Text style={styles.episode} maxFontSizeMultiplier={1.2}>
            {continueListening.episodeTitle}
          </Text>
          <Text style={styles.meta} maxFontSizeMultiplier={1.2}>
            {continueListening.showTitle}
          </Text>
          <Text style={styles.meta} maxFontSizeMultiplier={1.2}>
            {continueListening.onDevice
              ? `聽到 ${continueListening.positionLabel} · 在手機裡`
              : `聽到 ${continueListening.positionLabel}`}
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.empty} maxFontSizeMultiplier={1.3}>
          {shows.length === 0
            ? '先加入一個節目。要聽的那一集會整段下載，不靠會過期的網路位址。'
            : '選一集開始聽。聽到一半關掉，下次會從同一個地方繼續。'}
        </Text>
      )}

      {shows.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>
            我的節目
          </Text>
          {shows.map((show) => (
            <Pressable
              key={show.id}
              accessibilityRole="button"
              onPress={() => onOpenShow(show.id)}
              style={styles.show}
            >
              <Text style={styles.showTitle} maxFontSizeMultiplier={1.2}>
                {show.title}
              </Text>
              {show.author ? (
                <Text style={styles.meta} maxFontSizeMultiplier={1.2}>
                  {show.author}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      <BigButton label="加入節目" onPress={onAdd} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 16,
    paddingBottom: 32,
  },
  heading: {
    gap: 2,
  },
  title: {
    fontSize: fonts.title,
    fontWeight: '800',
    color: colors.ink,
  },
  zhName: {
    fontSize: fonts.section,
    fontWeight: '800',
    color: colors.ink,
  },
  lead: {
    fontSize: fonts.body,
    lineHeight: 30,
    color: colors.muted,
  },
  continue: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    gap: 6,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  kicker: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '800',
  },
  episode: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '800',
  },
  meta: {
    color: colors.muted,
    fontSize: fonts.body,
  },
  empty: {
    color: colors.ink,
    fontSize: fonts.body,
    lineHeight: 30,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: fonts.section,
    fontWeight: '800',
    color: colors.ink,
  },
  show: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.line,
  },
  showTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '800',
  },
});
