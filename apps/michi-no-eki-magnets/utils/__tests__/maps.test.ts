import { Linking, Platform } from 'react-native';

import {
  buildGoogleMapsDrivingRouteUrl,
  openGoogleMapsTransit,
  openMapsNavigation,
  openMapsParkingNavigation,
  openMapsParkingSearch,
  openMapsStampLocation,
} from '../maps';

describe('maps', () => {
  const openURL = jest.fn(async () => undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Linking, 'openURL').mockImplementation(openURL);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens Apple Maps driving directions with coordinates', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });

    await openMapsNavigation('apple', 35.0, 135.0, 'Himeji Station');

    expect(openURL).toHaveBeenCalledWith(
      expect.stringContaining('maps.apple.com/?daddr=35,135&dirflg=d'),
    );
  });

  it('opens Google Maps coordinate search on iOS for driving navigation', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });

    await openMapsNavigation('google', 35.0, 135.0, 'Himeji Station');

    expect(openURL).toHaveBeenCalledWith(
      'https://www.google.com/maps/search/?api=1&query=35%2C135',
    );
  });

  it('opens native Google navigation on Android for driving with coordinates', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });

    await openMapsNavigation('google', 35.0, 135.0, 'Himeji Station');

    expect(openURL).toHaveBeenCalledWith('google.navigation:q=35,135&mode=d');
  });

  it('opens Google transit directions on Android with coordinates', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });

    await openGoogleMapsTransit('google', 35.0, 135.0, 'Himeji Station');

    expect(openURL).toHaveBeenCalledWith(
      expect.stringContaining('destination=35%2C135'),
    );
    expect(openURL).toHaveBeenCalledWith(
      expect.stringContaining('travelmode=transit'),
    );
  });

  it('opens Apple Maps place view with coordinates instead of place name', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });

    await openMapsStampLocation('apple', {
      latitude: 35.0,
      longitude: 135.0,
      label: 'Stamp booth',
    });

    expect(openURL).toHaveBeenCalledWith(
      'http://maps.apple.com/?ll=35,135&q=35%2C135',
    );
  });

  it('opens native Google navigation for parking on Android with coordinates', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });

    await openMapsParkingNavigation('google', {
      latitude: 35.0,
      longitude: 135.0,
      label: 'Parking',
      googleLabel: 'Himeji parking',
    });

    expect(openURL).toHaveBeenCalledWith('google.navigation:q=35,135&mode=d');
  });

  it('opens geo intent for stamp locations on Android', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });

    await openMapsStampLocation('google', {
      latitude: 35.0,
      longitude: 135.0,
      label: 'Stamp booth',
      googleLabel: 'Himeji stamp',
    });

    expect(openURL).toHaveBeenCalledWith(
      expect.stringContaining('geo:35,135?q=35,135'),
    );
  });

  it('skips parking navigation when coordinates are missing', async () => {
    await openMapsParkingNavigation('google', {
      latitude: null,
      longitude: null,
      label: 'Parking',
    });

    expect(openURL).not.toHaveBeenCalled();
  });

  it('opens parking search queries', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });

    await openMapsParkingSearch('apple', '姫路城');

    expect(openURL).toHaveBeenCalledWith(
      expect.stringContaining('maps.apple.com/?q='),
    );
  });

  it('uses place id for origin only and labeled coordinates for destination and waypoints', () => {
    const url = buildGoogleMapsDrivingRouteUrl(
      { latitude: 35.0, longitude: 135.0, placeId: 'origin-place-id' },
      { latitude: 36.0, longitude: 136.0, label: '終點' },
      [{ latitude: 35.5, longitude: 135.5, label: '道の駅テスト' }],
    );

    expect(url).toContain('origin=35%2C135');
    expect(url).toContain('origin_place_id=origin-place-id');
    expect(url).not.toContain('origin=%E7'); // origin is not label@coords
    expect(url).toContain('destination=%E7%B5%82%E9%BB%9E%4036%2C136');
    expect(url).toContain('waypoints=%E9%81%93%E3%81%AE%E9%A7%85%E3%83%86%E3%82%B9%E3%83%88%4035.5%2C135.5');
    expect(url).not.toContain('destination_place_id');
    expect(url).toContain('travelmode=driving');
  });

  it('omits origin when using device location so Maps shows 你的位置', () => {
    const url = buildGoogleMapsDrivingRouteUrl(
      { latitude: 35.0, longitude: 135.0, useDeviceLocation: true },
      { latitude: 36.0, longitude: 136.0, label: '終點' },
      [{ latitude: 35.5, longitude: 135.5, label: '道の駅テスト' }],
    );

    expect(url).not.toContain('origin=');
    expect(url).not.toContain('origin_place_id');
    expect(url).toContain('destination=%E7%B5%82%E9%BB%9E%4036%2C136');
    expect(url).toContain('waypoints=%E9%81%93%E3%81%AE%E9%A7%85%E3%83%86%E3%82%B9%E3%83%88%4035.5%2C135.5');
  });

  it('adds avoid parameters for tolls and highways', () => {
    const url = buildGoogleMapsDrivingRouteUrl(
      { latitude: 35.0, longitude: 135.0 },
      { latitude: 36.0, longitude: 136.0 },
      [],
      { avoidHighways: true, avoidTolls: true },
    );

    expect(url).toContain('avoid=tolls%7Chighways');
  });

  it('falls back to coordinates when labels are empty', () => {
    const url = buildGoogleMapsDrivingRouteUrl(
      { latitude: 35.0, longitude: 135.0 },
      { latitude: 36.0, longitude: 136.0, label: '   ' },
      [{ latitude: 35.5, longitude: 135.5, label: '   ' }],
    );

    expect(url).toContain('origin=35%2C135');
    expect(url).not.toContain('origin_place_id');
    expect(url).toContain('destination=36%2C136');
    expect(url).toContain('waypoints=35.5%2C135.5');
  });
});
