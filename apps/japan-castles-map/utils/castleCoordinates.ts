import type { Castle } from '../types/castle';

type CoordinatePair = {
  latitude: number;
  longitude: number;
};

export function getCastleStampCoordinates(castle: Castle): CoordinatePair | null {
  const latitude = castle.latitude_stamp ?? castle.stampLatitude;
  const longitude = castle.longitude_stamp ?? castle.stampLongitude;

  if (latitude == null || longitude == null) {
    return null;
  }

  return { latitude, longitude };
}

export function getCastleParkingCoordinates(castle: Castle): CoordinatePair | null {
  const latitude = castle.latitude_parking ?? castle.parkingLatitude;
  const longitude = castle.longitude_parking ?? castle.parkingLongitude;

  if (latitude == null || longitude == null) {
    return null;
  }

  return { latitude, longitude };
}
