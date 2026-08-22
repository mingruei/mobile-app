import stations from '../../assets/stations.json';
import type { Station } from '../types/station';

describe('stations.json', () => {
  it('contains LinkData-imported active stations', () => {
    expect(stations.length).toBeGreaterThan(1000);

    const first = stations[0] as Station;
    expect(first.number).toBe(1);
    expect(first.name).toMatch(/^道の駅/);
    expect(first.prefecture).toBeTruthy();
    expect(first.latitude).toBeGreaterThan(20);
    expect(first.longitude).toBeGreaterThan(120);
  });

  it('uses unique ids and sequential display numbers', () => {
    const ids = new Set(stations.map((station) => station.id));
    const numbers = stations.map((station) => station.number);

    expect(ids.size).toBe(stations.length);
    expect(numbers[0]).toBe(1);
    expect(numbers[numbers.length - 1]).toBe(stations.length);
  });
});
