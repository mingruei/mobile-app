import { fetchDrivingRoutePolyline } from '../googleRoutes';

jest.mock('../googlePlacesConfig', () => ({
  getGooglePlacesApiKey: jest.fn(() => 'test-api-key'),
}));

const mockedFetch = jest.fn();
global.fetch = mockedFetch as unknown as typeof fetch;

describe('googleRoutes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches and decodes a driving route polyline', async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [
          {
            polyline: {
              encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
            },
          },
        ],
      }),
    });

    const polyline = await fetchDrivingRoutePolyline(
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
    );

    expect(polyline.length).toBeGreaterThan(1);
    expect(mockedFetch).toHaveBeenCalledWith(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Goog-Api-Key': 'test-api-key',
        }),
      }),
    );

    const request = mockedFetch.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as { routeModifiers?: unknown };
    expect(body.routeModifiers).toBeUndefined();
  });

  it('sends routeModifiers when avoiding highways and tolls', async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [
          {
            polyline: {
              encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
            },
          },
        ],
      }),
    });

    await fetchDrivingRoutePolyline(
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { avoidHighways: true, avoidTolls: true },
    );

    const request = mockedFetch.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as {
      routeModifiers?: { avoidHighways?: boolean; avoidTolls?: boolean };
    };
    expect(body.routeModifiers).toEqual({ avoidHighways: true, avoidTolls: true });
  });

  it('throws when Routes API returns no route', async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ routes: [] }),
    });

    await expect(
      fetchDrivingRoutePolyline(
        { latitude: 35.0, longitude: 135.0 },
        { latitude: 36.0, longitude: 136.0 },
      ),
    ).rejects.toThrow('Routes API returned no driving route');
  });
});
