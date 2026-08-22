import stations from '../../assets/stations.json';
import {
  getHokkaidoArea,
  getStationLocationFilterKey,
  HOKKAIDO_AREA_IDS,
} from '../hokkaidoAreas';

describe('hokkaidoAreas', () => {
  it('maps every Hokkaido station city to a sub-area', () => {
    const hokkaidoStations = stations.filter((station) => station.prefecture === '北海道');

    expect(hokkaidoStations.length).toBeGreaterThan(0);

    for (const station of hokkaidoStations) {
      expect(getHokkaidoArea(station.city)).not.toBeNull();
      expect(HOKKAIDO_AREA_IDS).toContain(getStationLocationFilterKey(station));
    }
  });
});
