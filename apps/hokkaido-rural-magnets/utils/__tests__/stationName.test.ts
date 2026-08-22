import { createStation } from './fixtures';
import {
  getStationDisplayName,
  getStationListSecondaryLine,
  getStationLocation,
  getStationNameSubtitle,
} from '../stationName';

describe('getStationDisplayName', () => {
  it('prefers Chinese municipality name when available', () => {
    const station = createStation({
      name: '帯広市',
      nameZh: '帶廣市',
    });

    expect(getStationDisplayName(station)).toBe('帶廣市');
  });

  it('falls back to Japanese name when Chinese is missing', () => {
    const station = createStation({
      name: '美瑛町',
      nameZh: null,
    });

    expect(getStationDisplayName(station)).toBe('美瑛町');
  });
});

describe('getStationLocation', () => {
  it('uses the Chinese municipality name in the location label', () => {
    const station = createStation({
      name: '帯広市',
      nameZh: '帶廣市',
      location: '北海道帯広市',
    });

    expect(getStationLocation(station)).toBe('北海道帶廣市');
  });
});

describe('getStationNameSubtitle', () => {
  it('shows Japanese and English names when Chinese differs from Japanese', () => {
    const station = createStation({
      name: '帯広市',
      nameZh: '帶廣市',
      nameEn: 'Obihiro',
    });

    expect(getStationNameSubtitle(station)).toBe('帯広市 · Obihiro');
  });

  it('shows only English when Chinese matches Japanese kanji', () => {
    const station = createStation({
      name: '美瑛町',
      nameZh: '美瑛町',
      nameEn: 'Biei',
    });

    expect(getStationNameSubtitle(station)).toBe('Biei');
  });
});

describe('getStationListSecondaryLine', () => {
  it('shows Chinese and English names on the list secondary line', () => {
    const station = createStation({
      name: '帯広市',
      nameZh: '帶廣市',
      nameEn: 'Obihiro',
    });

    expect(getStationListSecondaryLine(station)).toBe('帶廣市 · Obihiro');
  });

  it('shows Chinese name only when English is missing', () => {
    const station = createStation({
      name: '美瑛町',
      nameZh: '美瑛町',
      nameEn: null,
    });

    expect(getStationListSecondaryLine(station)).toBe('美瑛町');
  });
});
