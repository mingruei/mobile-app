import { Linking, Platform } from 'react-native';

import {
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
});
