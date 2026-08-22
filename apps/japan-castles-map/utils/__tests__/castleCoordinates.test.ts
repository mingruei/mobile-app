import { getCastleParkingCoordinates, getCastleStampCoordinates } from '../castleCoordinates';
import { createCastle } from './fixtures';

describe('castleCoordinates', () => {
  it('returns stamp coordinates from legacy fields', () => {
    const castle = createCastle({
      stampLatitude: 35.1,
      stampLongitude: 135.1,
    });

    expect(getCastleStampCoordinates(castle)).toEqual({
      latitude: 35.1,
      longitude: 135.1,
    });
  });

  it('prefers newer stamp coordinate fields', () => {
    const castle = createCastle({
      latitude_stamp: 35.2,
      longitude_stamp: 135.2,
      stampLatitude: 35.1,
      stampLongitude: 135.1,
    });

    expect(getCastleStampCoordinates(castle)).toEqual({
      latitude: 35.2,
      longitude: 135.2,
    });
  });

  it('returns null when stamp coordinates are missing', () => {
    expect(getCastleStampCoordinates(createCastle())).toBeNull();
  });

  it('returns parking coordinates from legacy fields', () => {
    const castle = createCastle({
      parkingLatitude: 35.3,
      parkingLongitude: 135.3,
    });

    expect(getCastleParkingCoordinates(castle)).toEqual({
      latitude: 35.3,
      longitude: 135.3,
    });
  });

  it('prefers newer parking coordinate fields', () => {
    const castle = createCastle({
      latitude_parking: 35.4,
      longitude_parking: 135.4,
      parkingLatitude: 35.3,
      parkingLongitude: 135.3,
    });

    expect(getCastleParkingCoordinates(castle)).toEqual({
      latitude: 35.4,
      longitude: 135.4,
    });
  });

  it('returns null when parking coordinates are missing', () => {
    expect(getCastleParkingCoordinates(createCastle())).toBeNull();
  });
});
