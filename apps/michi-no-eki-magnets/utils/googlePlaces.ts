import type { PlaceSuggestion } from '../types/placeSuggestion';
import type { SelectedPlace } from '../types/selectedPlace';
import { getGooglePlacesApiKey } from './googlePlacesConfig';

const AUTocomplete_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const PLACES_BASE_URL = 'https://places.googleapis.com/v1/places';

type LocalizedText = {
  text?: string;
};

type AutocompletePlacePrediction = {
  placeId?: string;
  text?: LocalizedText;
  structuredFormat?: {
    mainText?: LocalizedText;
    secondaryText?: LocalizedText;
  };
};

type AutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: AutocompletePlacePrediction;
  }>;
};

type PlaceDetailsResponse = {
  id?: string;
  displayName?: LocalizedText;
  formattedAddress?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
};

export function createPlaceSessionToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function parsePlaceSuggestion(prediction: AutocompletePlacePrediction): PlaceSuggestion | null {
  const placeId = prediction.placeId?.trim();
  if (!placeId) {
    return null;
  }

  const primaryText = prediction.structuredFormat?.mainText?.text?.trim()
    ?? prediction.text?.text?.trim()
    ?? '';
  const secondaryText = prediction.structuredFormat?.secondaryText?.text?.trim() ?? '';
  const fullText = prediction.text?.text?.trim()
    ?? [primaryText, secondaryText].filter(Boolean).join('，');

  if (!fullText) {
    return null;
  }

  return {
    placeId,
    primaryText: primaryText || fullText,
    secondaryText,
    fullText,
  };
}

export async function fetchPlaceSuggestions(
  input: string,
  sessionToken: string,
): Promise<PlaceSuggestion[]> {
  const apiKey = getGooglePlacesApiKey();
  const trimmedInput = input.trim();
  if (!apiKey || trimmedInput.length === 0) {
    return [];
  }

  const response = await fetch(AUTocomplete_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
    },
    body: JSON.stringify({
      input: trimmedInput,
      includedRegionCodes: ['jp'],
      languageCode: 'zh-TW',
      sessionToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`Place autocomplete failed (${response.status})`);
  }

  const payload = (await response.json()) as AutocompleteResponse;
  const suggestions = payload.suggestions ?? [];

  return suggestions
    .map((item) => (item.placePrediction ? parsePlaceSuggestion(item.placePrediction) : null))
    .filter((item): item is PlaceSuggestion => item != null);
}

export async function fetchSelectedPlace(
  placeId: string,
  sessionToken: string,
): Promise<SelectedPlace> {
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) {
    throw new Error('Google Places API key is not configured');
  }

  const encodedPlaceId = encodeURIComponent(placeId);
  const url = `${PLACES_BASE_URL}/${encodedPlaceId}?sessionToken=${encodeURIComponent(sessionToken)}`;
  const response = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,location',
    },
  });

  if (!response.ok) {
    throw new Error(`Place details failed (${response.status})`);
  }

  const payload = (await response.json()) as PlaceDetailsResponse;
  const latitude = payload.location?.latitude;
  const longitude = payload.location?.longitude;
  if (latitude == null || longitude == null) {
    throw new Error('Place details did not include coordinates');
  }

  const label = payload.displayName?.text?.trim()
    ?? payload.formattedAddress?.trim()
    ?? placeId;

  return {
    placeId,
    label,
    formattedAddress: payload.formattedAddress?.trim() ?? null,
    latitude,
    longitude,
  };
}
