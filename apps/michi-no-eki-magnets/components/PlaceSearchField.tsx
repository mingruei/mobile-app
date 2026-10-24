import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors } from '../constants/theme';
import { usePlaceAutocomplete } from '../hooks/usePlaceAutocomplete';
import { useI18n } from '../i18n';
import type { SelectedPlace } from '../types/selectedPlace';

type PlaceSearchFieldProps = {
  label: string;
  placeholder: string;
  value: SelectedPlace | null;
  onChange: (place: SelectedPlace | null) => void;
};

export function PlaceSearchField({
  label,
  placeholder,
  value,
  onChange,
}: PlaceSearchFieldProps) {
  const { t } = useI18n();
  const {
    query,
    setQuery,
    suggestions,
    status,
    errorMessage,
    isConfigured,
    beginSession,
    clearSession,
    selectSuggestion,
  } = usePlaceAutocomplete();
  const [isEditing, setIsEditing] = useState(value == null);

  useEffect(() => {
    if (value == null) {
      return;
    }

    setQuery(value.label);
    setIsEditing(false);
  }, [setQuery, value]);

  const handleFocus = useCallback(() => {
    beginSession();
    if (value) {
      setIsEditing(true);
      setQuery(value.label);
      onChange(null);
    }
  }, [beginSession, onChange, setQuery, value]);

  const handleClear = useCallback(() => {
    onChange(null);
    setQuery('');
    clearSession();
    setIsEditing(true);
  }, [clearSession, onChange, setQuery]);

  const handleSelectSuggestion = useCallback(
    async (placeId: string) => {
      const suggestion = suggestions.find((item) => item.placeId === placeId);
      if (!suggestion) {
        return;
      }

      try {
        const selected = await selectSuggestion(suggestion);
        onChange(selected);
        setIsEditing(false);
      } catch {
        // Error state is handled inside the hook.
      }
    },
    [onChange, selectSuggestion, suggestions],
  );

  const showSuggestions = isEditing && query.trim().length >= 2 && isConfigured;
  const isLoading = status === 'loading';

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={handleFocus}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          editable={isConfigured}
        />
        {isLoading ? <ActivityIndicator size="small" color={colors.original} style={styles.spinner} /> : null}
        {value && !isEditing ? (
          <Pressable accessibilityRole="button" onPress={handleClear} style={styles.clearButton}>
            <Text style={styles.clearLabel}>{t('routePlan.clearPlace')}</Text>
          </Pressable>
        ) : null}
      </View>

      {!isConfigured ? (
        <Text style={styles.hint}>{t('routePlan.apiKeyMissing')}</Text>
      ) : null}

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      {showSuggestions && suggestions.length > 0 ? (
        <View style={styles.suggestions}>
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion.placeId}
              accessibilityRole="button"
              onPress={() => void handleSelectSuggestion(suggestion.placeId)}
              style={styles.suggestionRow}
            >
              <Text style={styles.suggestionPrimary}>{suggestion.primaryText}</Text>
              {suggestion.secondaryText ? (
                <Text style={styles.suggestionSecondary}>{suggestion.secondaryText}</Text>
              ) : null}
            </Pressable>
          ))}
          <Text style={styles.attribution}>{t('routePlan.googleAttribution')}</Text>
        </View>
      ) : null}

      {showSuggestions && !isLoading && suggestions.length === 0 && status === 'ready' ? (
        <Text style={styles.hint}>{t('routePlan.noSuggestions')}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    fontSize: 16,
    color: colors.text,
  },
  spinner: {
    marginRight: 4,
  },
  clearButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
  },
  error: {
    fontSize: 13,
    color: colors.continued,
    lineHeight: 20,
  },
  suggestions: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 2,
  },
  suggestionPrimary: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  suggestionSecondary: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  attribution: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 12,
    color: colors.textMuted,
  },
});
