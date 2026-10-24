import type { Station } from '../../types/station';
import { fetchDrivingRoutePolyline } from '../googleRoutes';
import { createProgressEntry } from '../../types/stationProgress';
import {
  clampCorridorKm,
  clampMapWaypointCount,
  corridorKmToMeters,
  filterStationsForRoutePlan,
  findStationsAlongPolyline,
  findStationsAlongRoute,
  pickWaypointStations,
  planDrivingRouteStations,
  roadAvoidKeysToOptions,
} from '../routePlan';

jest.mock('../googleRoutes', () => ({
  ...jest.requireActual('../googleRoutes'),
  fetchDrivingRoutePolyline: jest.fn(),
}));

const mockedFetchDrivingRoutePolyline = fetchDrivingRoutePolyline as jest.MockedFunction<
  typeof fetchDrivingRoutePolyline
>;

function station(id: number, latitude: number, longitude: number, name = `Station ${id}`): Station {
  return {
    id,
    number: id,
    name,
    prefecture: '測試',
    city: '測試市',
    location: '',
    latitude,
    longitude,
    services: [],
  };
}

describe('routePlan corridor helpers', () => {
  it('converts km to meters', () => {
    expect(corridorKmToMeters(20)).toBe(20_000);
  });

  it('clamps corridor km to allowed range', () => {
    expect(clampCorridorKm(3)).toBe(5);
    expect(clampCorridorKm(100)).toBe(60);
  });

  it('clamps map waypoint count to allowed range', () => {
    expect(clampMapWaypointCount(0)).toBe(1);
    expect(clampMapWaypointCount(12)).toBe(9);
  });
});

describe('findStationsAlongRoute', () => {
  it('returns stations near the segment ordered from origin to destination', () => {
    const origin = { latitude: 35.0, longitude: 135.0 };
    const destination = { latitude: 36.0, longitude: 136.0 };
    const stations = [
      station(1, 35.5, 135.5, 'Mid'),
      station(2, 35.05, 135.05, 'Near origin'),
      station(3, 40.0, 140.0, 'Far away'),
    ];

    const result = findStationsAlongRoute(stations, origin, destination, {
      corridorMeters: 30_000,
    });

    expect(result.stations.map((item) => item.id)).toEqual([2, 1]);
    expect(result.waypointStations.map((item) => item.id)).toEqual([2, 1]);
  });

  it('finds stations near a polyline path', () => {
    const polyline = [
      { latitude: 35.0, longitude: 135.0 },
      { latitude: 35.5, longitude: 135.5 },
      { latitude: 36.0, longitude: 136.0 },
    ];
    const stations = [
      station(1, 35.25, 135.25, 'On path'),
      station(2, 40.0, 140.0, 'Far'),
    ];

    const result = findStationsAlongPolyline(stations, polyline, {
      corridorMeters: 30_000,
    });

    expect(result.stations.map((item) => item.id)).toEqual([1]);
  });

  it('returns all corridor matches without maxResults cap', () => {
    const origin = { latitude: 35.0, longitude: 135.0 };
    const destination = { latitude: 36.0, longitude: 136.0 };
    const stations = Array.from({ length: 12 }, (_, index) =>
      station(index + 1, 35.1 + index * 0.05, 135.1 + index * 0.05),
    );

    const result = findStationsAlongRoute(stations, origin, destination, {
      corridorMeters: 50_000,
    });

    expect(result.stations).toHaveLength(12);
    expect(result.waypointStations).toHaveLength(12);
  });
});

describe('roadAvoidKeysToOptions', () => {
  it('maps selected road avoid keys to Routes API options', () => {
    expect(roadAvoidKeysToOptions(new Set(['highways']))).toEqual({
      avoidHighways: true,
      avoidTolls: false,
    });
    expect(roadAvoidKeysToOptions(new Set(['highways', 'tolls']))).toEqual({
      avoidHighways: true,
      avoidTolls: true,
    });
  });
});

describe('filterStationsForRoutePlan', () => {
  it('applies selected exclude rules together', () => {
    const stations = [
      station(1, 35.1, 135.1, 'Visited only'),
      station(2, 35.2, 135.2, 'Magnet only'),
      station(3, 35.3, 135.3, 'Not sold only'),
      station(4, 35.4, 135.4, 'Clear'),
    ];
    const getProgress = (id: number) => {
      if (id === 1) {
        return createProgressEntry({ visited: true });
      }
      if (id === 2) {
        return createProgressEntry({ magnet: true });
      }
      if (id === 3) {
        return createProgressEntry({ magnetNotSold: true });
      }
      return createProgressEntry();
    };

    const filtered = filterStationsForRoutePlan(
      stations,
      new Set(['visited', 'magnet', 'magnetNotSold']),
      getProgress,
    );

    expect(filtered.map((item) => item.id)).toEqual([4]);
  });
});

describe('pickWaypointStations', () => {
  it('picks evenly spaced stations up to the limit', () => {
    const stations = Array.from({ length: 12 }, (_, index) =>
      station(index + 1, 35.1 + index * 0.05, 135.1 + index * 0.05),
    );

    expect(pickWaypointStations(stations, 3).map((item) => item.id)).toEqual([1, 7, 12]);
  });

  it('picks a single midpoint when limit is 1', () => {
    const stations = Array.from({ length: 5 }, (_, index) => station(index + 1, 35, 135 + index));

    expect(pickWaypointStations(stations, 1)).toHaveLength(1);
    expect(pickWaypointStations(stations, 1)[0]!.id).toBe(3);
  });
});

describe('planDrivingRouteStations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses driving polyline when Routes API succeeds', async () => {
    mockedFetchDrivingRoutePolyline.mockResolvedValue([
      { latitude: 35.0, longitude: 135.0 },
      { latitude: 36.0, longitude: 136.0 },
    ]);

    const planned = await planDrivingRouteStations(
      [station(1, 35.5, 135.5)],
      { latitude: 35.0, longitude: 135.0 },
      { latitude: 36.0, longitude: 136.0 },
      { corridorMeters: 30_000 },
    );

    expect(planned.source).toBe('driving');
    expect(planned.result.stations).toHaveLength(1);
  });

  it('falls back to straight line when Routes API fails', async () => {
    mockedFetchDrivingRoutePolyline.mockRejectedValue(new Error('network'));

    const planned = await planDrivingRouteStations(
      [station(1, 35.5, 135.5)],
      { latitude: 35.0, longitude: 135.0 },
      { latitude: 36.0, longitude: 136.0 },
      { corridorMeters: 30_000 },
    );

    expect(planned.source).toBe('straight');
    expect(planned.warningMessage).toBeTruthy();
  });
});
