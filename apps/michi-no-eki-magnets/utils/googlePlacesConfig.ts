export function getGooglePlacesApiKey(): string | null {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY?.trim();
  return apiKey && apiKey.length > 0 ? apiKey : null;
}

export function isGooglePlacesConfigured(): boolean {
  return getGooglePlacesApiKey() != null;
}
