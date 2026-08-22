import * as Location from 'expo-location';
import { Platform } from 'react-native';

import {
  distanceInMeters,
  findNearestCastleWithinRadius,
  normalizePrefectureName,
  resolveLocalStartupContext,
} from '../localPrefecture';
import { createStation } from './fixtures';

const mockedGetPermissions = Location.getForegroundPermissionsAsync as jest.MockedFunction<
  typeof Location.getForegroundPermissionsAsync
>;
const mockedRequestPermissions = Location.requestForegroundPermissionsAsync as jest.MockedFunction<
  typeof Location.requestForegroundPermissionsAsync
>;
const mockedGetPosition = Location.getCurrentPositionAsync as jest.MockedFunction<
  typeof Location.getCurrentPositionAsync
>;
const mockedReverseGeocode = Location.reverseGeocodeAsync as jest.MockedFunction<
  typeof Location.reverseGeocodeAsync
>;

describe('localPrefecture', () => {
  describe('normalizePrefectureName', () => {
    it('keeps canonical Japanese prefecture names', () => {
      expect(normalizePrefectureName('島根県')).toBe('島根県');
      expect(normalizePrefectureName('京都府')).toBe('京都府');
      expect(normalizePrefectureName('北海道')).toBe('北海道');
    });

    it('maps English reverse-geocode labels to Japanese keys', () => {
      expect(normalizePrefectureName('Shimane')).toBe('島根県');
      expect(normalizePrefectureName('Shimane Prefecture')).toBe('島根県');
      expect(normalizePrefectureName('Yamaguchi-ken')).toBe('山口県');
    });

    it('maps Traditional Chinese labels to Japanese keys', () => {
      expect(normalizePrefectureName('島根縣')).toBe('島根県');
    });
  });

  describe('distanceInMeters', () => {
    it('returns zero for identical coordinates', () => {
      expect(distanceInMeters(35.0116, 135.7681, 35.0116, 135.7681)).toBe(0);
    });

    it('returns a positive distance for nearby points', () => {
      const distance = distanceInMeters(35.0116, 135.7681, 35.0216, 135.7781);
      expect(distance).toBeGreaterThan(1000);
      expect(distance).toBeLessThan(2000);
    });
  });

  describe('findNearestCastleWithinRadius', () => {
    const stations = [
      createStation({ id: 1, name: 'A', latitude: 35.0, longitude: 135.0 }),
      createStation({ id: 2, name: 'B', latitude: 35.0004, longitude: 135.0004 }),
    ];

    it('returns the nearest station within radius', () => {
      const nearest = findNearestCastleWithinRadius(stations, 35.0, 135.0, 100);
      expect(nearest?.id).toBe(1);
    });

    it('returns null when no station is within radius', () => {
      expect(findNearestCastleWithinRadius(stations, 36.0, 136.0, 1000)).toBeNull();
    });
  });

  describe('resolveLocalStartupContext', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
      mockedGetPermissions.mockResolvedValue({ status: 'denied' } as never);
      mockedRequestPermissions.mockResolvedValue({ status: 'denied' } as never);
    });

    it('returns empty context when location permission is denied', async () => {
      const result = await resolveLocalStartupContext([createStation()]);
      expect(result).toEqual({ filter: null, nearbyStation: null });
    });

    it('returns prefecture filter and nearby station when location is granted in Japan', async () => {
      const stations = [
        createStation({ id: 1, prefecture: '京都府', latitude: 35.0116, longitude: 135.7681 }),
        createStation({ id: 2, prefecture: '京都府', latitude: 35.0117, longitude: 135.7682 }),
      ];

      mockedGetPermissions.mockResolvedValue({ status: 'granted' } as never);
      mockedGetPosition.mockResolvedValue({
        coords: { latitude: 35.0116, longitude: 135.7681 },
      } as never);
      mockedReverseGeocode.mockResolvedValue([{ subregion: '京都府' }] as never);

      const result = await resolveLocalStartupContext(stations, 100);

      expect(result.filter).toEqual({
        regionId: 'kinki',
        prefecture: '京都府',
      });
      expect(result.nearbyStation?.id).toBe(1);
    });

    it('falls back to nearest station prefecture when geocoding fails', async () => {
      const stations = [
        createStation({ id: 1, prefecture: '京都府', latitude: 35.0116, longitude: 135.7681 }),
        createStation({ id: 2, prefecture: '大阪府', latitude: 34.6937, longitude: 135.5023 }),
      ];

      mockedGetPermissions.mockResolvedValue({ status: 'granted' } as never);
      mockedGetPosition.mockResolvedValue({
        coords: { latitude: 35.0116, longitude: 135.7681 },
      } as never);
      mockedReverseGeocode.mockResolvedValue([] as never);

      const result = await resolveLocalStartupContext(stations, 100);

      expect(result.filter?.prefecture).toBe('京都府');
    });

    it('accepts English reverse-geocode labels at Tsuwano / Shimane', async () => {
      const stations = [
        createStation({
          id: 1,
          name: '松江城',
          prefecture: '島根県',
          latitude: 35.475,
          longitude: 133.0506,
        }),
        createStation({
          id: 2,
          name: '津和野城',
          prefecture: '島根県',
          latitude: 34.460833,
          longitude: 131.764167,
        }),
        createStation({
          id: 3,
          name: '萩城',
          prefecture: '山口県',
          latitude: 34.4222,
          longitude: 131.3981,
        }),
      ];

      mockedGetPermissions.mockResolvedValue({ status: 'granted' } as never);
      mockedGetPosition.mockResolvedValue({
        coords: { latitude: 34.460833, longitude: 131.764167 },
      } as never);
      mockedReverseGeocode.mockResolvedValue([{ region: 'Shimane Prefecture' }] as never);

      const result = await resolveLocalStartupContext(stations, 100);

      expect(result.filter?.prefecture).toBe('島根県');
    });

    it('trusts reverse geocode over a nearer station across the prefecture border', async () => {
      // Standing in Yamaguchi, closer to Tsuwano (Shimane) than to Hagi.
      const stations = [
        createStation({
          id: 1,
          name: '津和野城',
          prefecture: '島根県',
          latitude: 34.460833,
          longitude: 131.764167,
        }),
        createStation({
          id: 2,
          name: '萩城',
          prefecture: '山口県',
          latitude: 34.4222,
          longitude: 131.3981,
        }),
      ];

      mockedGetPermissions.mockResolvedValue({ status: 'granted' } as never);
      mockedGetPosition.mockResolvedValue({
        coords: { latitude: 34.43, longitude: 131.70 },
      } as never);
      mockedReverseGeocode.mockResolvedValue([{ region: '山口県' }] as never);

      const result = await resolveLocalStartupContext(stations, 100);

      expect(result.filter?.prefecture).toBe('山口県');
    });

    it('falls back to Tsuwano/Shimane when geocoding fails near the border', async () => {
      const stations = [
        createStation({
          id: 1,
          name: '松江城',
          prefecture: '島根県',
          latitude: 35.475,
          longitude: 133.0506,
        }),
        createStation({
          id: 2,
          name: '津和野城',
          prefecture: '島根県',
          latitude: 34.460833,
          longitude: 131.764167,
        }),
        createStation({
          id: 3,
          name: '萩城',
          prefecture: '山口県',
          latitude: 34.4222,
          longitude: 131.3981,
        }),
        createStation({
          id: 4,
          name: '岩国城',
          prefecture: '山口県',
          latitude: 34.1753,
          longitude: 132.1744,
        }),
      ];

      mockedGetPermissions.mockResolvedValue({ status: 'granted' } as never);
      mockedGetPosition.mockResolvedValue({
        coords: { latitude: 34.460833, longitude: 131.764167 },
      } as never);
      mockedReverseGeocode.mockResolvedValue([] as never);

      const result = await resolveLocalStartupContext(stations, 100);

      expect(result.filter?.prefecture).toBe('島根県');
      expect(result.nearbyStation?.name).toBe('津和野城');
    });
  });
});
