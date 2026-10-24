import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { PodcastSearchHit } from '../utils/itunes';
import { BigButton } from './BigButton';
import { colors, fonts } from '../theme';

type Props = {
  results: PodcastSearchHit[];
  searchBusy: boolean;
  addBusy: boolean;
  error: string | null;
  onBack: () => void;
  onSearch: (term: string) => void;
  onAddFeed: (url: string) => void;
  onPick: (hit: PodcastSearchHit) => void;
};

export function AddShowScreen({
  results,
  searchBusy,
  addBusy,
  error,
  onBack,
  onSearch,
  onAddFeed,
  onPick,
}: Props) {
  const [term, setTerm] = useState('');
  const [feedUrl, setFeedUrl] = useState('');

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" onPress={onBack}>
        <Text style={styles.back} maxFontSizeMultiplier={1.2}>
          返回
        </Text>
      </Pressable>
      <Text style={styles.title} maxFontSizeMultiplier={1.2}>
        加入節目
      </Text>

      <Text style={styles.label} maxFontSizeMultiplier={1.2}>
        搜尋
      </Text>
      <TextInput
        value={term}
        onChangeText={setTerm}
        placeholder="節目名稱"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
        maxFontSizeMultiplier={1.2}
      />
      <BigButton label={searchBusy ? '搜尋中' : '搜尋'} onPress={() => onSearch(term)} disabled={searchBusy || addBusy} />

      {results.map((hit) => (
        <Pressable
          key={hit.feedUrl}
          accessibilityRole="button"
          disabled={addBusy}
          onPress={() => onPick(hit)}
          style={styles.hit}
        >
          <Text style={styles.hitTitle} maxFontSizeMultiplier={1.2}>
            {hit.title}
          </Text>
          {hit.author ? (
            <Text style={styles.meta} maxFontSizeMultiplier={1.2}>
              {hit.author}
            </Text>
          ) : null}
        </Pressable>
      ))}

      <Text style={styles.label} maxFontSizeMultiplier={1.2}>
        或貼上 RSS
      </Text>
      <TextInput
        value={feedUrl}
        onChangeText={setFeedUrl}
        placeholder="https://"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
        maxFontSizeMultiplier={1.2}
      />
      <BigButton
        label={addBusy ? '加入中' : '用這個網址加入'}
        onPress={() => onAddFeed(feedUrl)}
        disabled={addBusy}
      />

      {addBusy || searchBusy ? <ActivityIndicator color={colors.accent} /> : null}
      {error ? (
        <View>
          <Text style={styles.error} maxFontSizeMultiplier={1.3}>
            {error}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 14,
    paddingBottom: 40,
  },
  back: {
    color: colors.accent,
    fontSize: 20,
    fontWeight: '800',
  },
  title: {
    fontSize: fonts.title,
    fontWeight: '800',
    color: colors.ink,
  },
  label: {
    marginTop: 8,
    fontSize: fonts.section,
    fontWeight: '800',
    color: colors.ink,
  },
  input: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    fontSize: fonts.body,
    color: colors.ink,
  },
  hit: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.line,
  },
  hitTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
  },
  meta: {
    fontSize: 18,
    color: colors.muted,
  },
  error: {
    color: colors.red,
    fontSize: fonts.body,
    lineHeight: 28,
  },
});
