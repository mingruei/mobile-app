import { useCallback, useEffect, useRef, useState } from 'react';

import type { PlaceSuggestion } from '../types/placeSuggestion';
import type { SelectedPlace } from '../types/selectedPlace';
import { isGooglePlacesConfigured } from '../utils/googlePlacesConfig';
import {
  createPlaceSessionToken,
  fetchPlaceSuggestions,
  fetchSelectedPlace,
} from '../utils/googlePlaces';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export type PlaceAutocompleteStatus = 'idle' | 'loading' | 'ready' | 'error';

export type UsePlaceAutocompleteResult = {
  query: string;
  setQuery: (value: string) => void;
  suggestions: readonly PlaceSuggestion[];
  status: PlaceAutocompleteStatus;
  errorMessage: string | null;
  isConfigured: boolean;
  beginSession: () => void;
  clearSession: () => void;
  selectSuggestion: (suggestion: PlaceSuggestion) => Promise<SelectedPlace>;
};

export function usePlaceAutocomplete(): UsePlaceAutocompleteResult {
  const [query, setQueryState] = useState('');
  const [suggestions, setSuggestions] = useState<readonly PlaceSuggestion[]>([]);
  const [status, setStatus] = useState<PlaceAutocompleteStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const isConfigured = isGooglePlacesConfigured();

  const beginSession = useCallback(() => {
    sessionTokenRef.current = createPlaceSessionToken();
    setErrorMessage(null);
  }, []);

  const clearSession = useCallback(() => {
    sessionTokenRef.current = null;
    requestIdRef.current += 1;
    setSuggestions([]);
    setStatus('idle');
    setErrorMessage(null);
  }, []);

  const setQuery = useCallback(
    (value: string) => {
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = createPlaceSessionToken();
      }
      setQueryState(value);
    },
    [],
  );

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!isConfigured) {
      setSuggestions([]);
      setStatus('idle');
      return;
    }

    if (trimmedQuery.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setStatus('idle');
      setErrorMessage(null);
      return;
    }

    if (!sessionTokenRef.current) {
      sessionTokenRef.current = createPlaceSessionToken();
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setStatus('loading');
    setErrorMessage(null);

    const timeout = setTimeout(() => {
      void fetchPlaceSuggestions(trimmedQuery, sessionTokenRef.current!)
        .then((nextSuggestions) => {
          if (requestIdRef.current !== requestId) {
            return;
          }

          setSuggestions(nextSuggestions);
          setStatus('ready');
        })
        .catch((error: unknown) => {
          if (requestIdRef.current !== requestId) {
            return;
          }

          setSuggestions([]);
          setStatus('error');
          setErrorMessage(error instanceof Error ? error.message : 'Place autocomplete failed');
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, [isConfigured, query]);

  const selectSuggestion = useCallback(async (suggestion: PlaceSuggestion) => {
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = createPlaceSessionToken();
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      const selected = await fetchSelectedPlace(suggestion.placeId, sessionTokenRef.current);
      setQueryState(selected.label);
      setSuggestions([]);
      setStatus('ready');
      sessionTokenRef.current = null;
      return selected;
    } catch (error: unknown) {
      setStatus('error');
      const message = error instanceof Error ? error.message : 'Place details failed';
      setErrorMessage(message);
      throw error;
    }
  }, []);

  return {
    query,
    setQuery,
    suggestions,
    status,
    errorMessage,
    isConfigured,
    beginSession,
    clearSession,
    selectSuggestion,
  };
}
