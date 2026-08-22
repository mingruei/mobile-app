import stations from '../../assets/hokkaido-countries.json';
import type { Station } from '../types/station';

describe('hokkaido-countries.json', () => {
  it('contains all 179 Hokkaido municipalities', () => {
    expect(stations).toHaveLength(179);

    const first = stations[0] as Station;
    expect(first.number).toBe(1);
    expect(first.prefecture).toBe('北海道');
    expect(first.latitude).toBeGreaterThan(41);
    expect(first.longitude).toBeGreaterThan(139);
  });

  it('uses unique ids and sequential display numbers', () => {
    const ids = new Set(stations.map((station) => station.id));
    const numbers = stations.map((station) => station.number);

    expect(ids.size).toBe(stations.length);
    expect(numbers[0]).toBe(1);
    expect(numbers[numbers.length - 1]).toBe(stations.length);
  });

  it('includes English municipality names for keyword search', () => {
    for (const station of stations as Station[]) {
      expect(station.nameEn).toMatch(/^[A-Za-z][A-Za-z\- ]*$/);
    }

    const asahikawa = (stations as Station[]).find((station) => station.name === '旭川市');
    const biei = (stations as Station[]).find((station) => station.name === '美瑛町');

    expect(asahikawa?.nameEn).toBe('Asahikawa');
    expect(biei?.nameEn).toBe('Biei');
  });
});
