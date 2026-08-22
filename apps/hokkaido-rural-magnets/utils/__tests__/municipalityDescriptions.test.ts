import descriptionsZh from '../../data-source/hokkaido-municipality-descriptions-zh.json';
import stations from '../../assets/hokkaido-countries.json';
import type { Station } from '../../types/station';

const stationList = stations as Station[];

function buildDescriptionZhLookup(records: Record<string, string>): Map<number, string> {
  return new Map(Object.entries(records).map(([id, text]) => [Number(id), text]));
}

describe('hokkaido-municipality-descriptions-zh.json', () => {
  it('contains 179 Chinese descriptions aligned with station ids', () => {
    const lookup = buildDescriptionZhLookup(descriptionsZh);
    expect(lookup.size).toBe(179);
    expect(stationList).toHaveLength(179);

    for (const station of stationList) {
      const description = lookup.get(station.id);
      expect(description).toBeTruthy();
      expect(description!.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('hokkaido-countries.json shortDescriptionZh', () => {
  it('includes Chinese descriptions for municipalities with Japanese slogans', () => {
    const withJapanese = stationList.filter((station) => station.shortDescription);
    expect(withJapanese.length).toBeGreaterThan(0);

    for (const station of withJapanese) {
      expect(station.shortDescriptionZh?.trim()).toBeTruthy();
    }
  });
});

describe('hokkaido-countries.json nameZh', () => {
  it('includes Chinese municipality names for every station', () => {
    for (const station of stationList) {
      expect(station.nameZh?.trim()).toBeTruthy();
    }
  });

  it('converts common shinjitai characters to Traditional Chinese', () => {
    const obihiro = stationList.find((station) => station.name === '帯広市');
    const niseko = stationList.find((station) => station.name === 'ニセコ町');
    const yoichi = stationList.find((station) => station.name === '余市町');

    expect(obihiro?.nameZh).toBe('帶廣市');
    expect(niseko?.nameZh).toBe('二世古町');
    expect(yoichi?.nameZh).toBe('余市町');
  });

  it('preserves Japanese kanji in municipality names', () => {
    const rebun = stationList.find((station) => station.name === '礼文町');
    const iwanai = stationList.find((station) => station.name === '岩内町');

    expect(rebun?.nameZh).toBe('礼文町');
    expect(iwanai?.nameZh).toBe('岩内町');
  });
});

describe('Traditional Chinese copy quality', () => {
  const mainlandTerms = ['城市', '软件', '网络', '信息', '视频', '默认', '设置', '导出', '导入', '搜索', '地图', '支持開發', '文件資料夾'];

  it('avoids mainland phrasing in municipality descriptions', () => {
    for (const text of Object.values(descriptionsZh)) {
      for (const term of mainlandTerms) {
        expect(text).not.toContain(term);
      }
    }
  });

  it('avoids simplified-only characters in municipality descriptions', () => {
    for (const text of Object.values(descriptionsZh)) {
      expect(text).not.toMatch(/城市/);
    }
  });

  it('preserves historical terms like castle towns', () => {
    expect(descriptionsZh['16942']).toContain('城下町');
  });
});
