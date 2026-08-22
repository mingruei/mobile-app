import { createStation } from './fixtures';
import {
  buildStationListAccessibilityLabel,
  getStationProgressSummary,
} from '../stationAccessibility';

const labels = {
  visited: '已造訪',
  magnet: '已取得磁鐵',
  magnetNotSold: '未販賣磁鐵',
  none: '尚未記錄進度',
};

describe('getStationProgressSummary', () => {
  it('returns none label when no progress flags are set', () => {
    expect(getStationProgressSummary(undefined, labels)).toBe('尚未記錄進度');
    expect(getStationProgressSummary({ visited: false, magnet: false, magnetNotSold: false }, labels)).toBe(
      '尚未記錄進度',
    );
  });

  it('joins active progress flags', () => {
    expect(
      getStationProgressSummary({ visited: true, magnet: true, magnetNotSold: false }, labels),
    ).toBe('已造訪，已取得磁鐵');
  });
});

describe('buildStationListAccessibilityLabel', () => {
  it('includes Japanese name, secondary line, and progress summary', () => {
    const station = createStation({
      name: '帯広市',
      nameZh: '帶廣市',
      nameEn: 'Obihiro',
    });

    expect(
      buildStationListAccessibilityLabel(
        station,
        { visited: true, magnet: false, magnetNotSold: false },
        labels,
      ),
    ).toBe('帯広市，帶廣市 · Obihiro，已造訪');
  });
});
