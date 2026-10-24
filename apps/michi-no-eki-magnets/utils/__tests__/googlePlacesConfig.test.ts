import { getGooglePlacesApiKey, isGooglePlacesConfigured } from '../googlePlacesConfig';

describe('googlePlacesConfig', () => {
  const original = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
    } else {
      process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY = original;
    }
  });

  it('returns null and unconfigured when the env key is missing', () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

    expect(getGooglePlacesApiKey()).toBeNull();
    expect(isGooglePlacesConfigured()).toBe(false);
  });

  it('trims and returns a configured API key', () => {
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY = '  test-key  ';

    expect(getGooglePlacesApiKey()).toBe('test-key');
    expect(isGooglePlacesConfigured()).toBe(true);
  });

  it('treats blank keys as missing', () => {
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY = '   ';

    expect(getGooglePlacesApiKey()).toBeNull();
    expect(isGooglePlacesConfigured()).toBe(false);
  });
});
