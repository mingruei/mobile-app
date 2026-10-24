import {
  createPlaceSessionToken,
  fetchPlaceSuggestions,
  fetchSelectedPlace,
} from '../googlePlaces';

jest.mock('../googlePlacesConfig', () => ({
  getGooglePlacesApiKey: jest.fn(() => 'test-api-key'),
}));

const mockedFetch = jest.fn();
global.fetch = mockedFetch as unknown as typeof fetch;

describe('googlePlaces', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a session token', () => {
    expect(createPlaceSessionToken()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('returns no suggestions for blank input', async () => {
    await expect(fetchPlaceSuggestions('   ', 'session-token')).resolves.toEqual([]);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('parses autocomplete suggestions', async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        suggestions: [
          {
            placePrediction: {
              placeId: 'ChIJTest',
              text: { text: '東京駅, 日本' },
              structuredFormat: {
                mainText: { text: '東京駅' },
                secondaryText: { text: '日本、東京都' },
              },
            },
          },
        ],
      }),
    });

    await expect(fetchPlaceSuggestions('東京', 'session-token')).resolves.toEqual([
      {
        placeId: 'ChIJTest',
        primaryText: '東京駅',
        secondaryText: '日本、東京都',
        fullText: '東京駅, 日本',
      },
    ]);

    expect(mockedFetch).toHaveBeenCalledWith(
      'https://places.googleapis.com/v1/places:autocomplete',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Goog-Api-Key': 'test-api-key',
        }),
        body: JSON.stringify({
          input: '東京',
          includedRegionCodes: ['jp'],
          languageCode: 'zh-TW',
          sessionToken: 'session-token',
        }),
      }),
    );
  });

  it('fetches selected place details', async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'places/ChIJTest',
        displayName: { text: '東京駅' },
        formattedAddress: '日本、〒100-0005 東京都千代田区丸の内１丁目',
        location: {
          latitude: 35.681236,
          longitude: 139.767125,
        },
      }),
    });

    await expect(fetchSelectedPlace('ChIJTest', 'session-token')).resolves.toEqual({
      placeId: 'ChIJTest',
      label: '東京駅',
      formattedAddress: '日本、〒100-0005 東京都千代田区丸の内１丁目',
      latitude: 35.681236,
      longitude: 139.767125,
    });

    expect(mockedFetch).toHaveBeenCalledWith(
      'https://places.googleapis.com/v1/places/ChIJTest?sessionToken=session-token',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Goog-Api-Key': 'test-api-key',
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location',
        }),
      }),
    );
  });
});
