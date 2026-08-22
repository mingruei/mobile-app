import type { Station } from '../types/station';

export type CoordinatePair = {
  latitude: number;
  longitude: number;
};

export function getStationCoordinates(station: Station): CoordinatePair {
  return {
    latitude: station.latitude,
    longitude: station.longitude,
  };
}
