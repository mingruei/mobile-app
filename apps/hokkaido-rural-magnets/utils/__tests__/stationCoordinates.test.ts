import { getStationCoordinates } from '../stationCoordinates';
import { createStation } from './fixtures';

describe('stationCoordinates', () => {
  it('returns station coordinates', () => {
    const station = createStation({ latitude: 35.1, longitude: 135.2 });
    expect(getStationCoordinates(station)).toEqual({
      latitude: 35.1,
      longitude: 135.2,
    });
  });
});
