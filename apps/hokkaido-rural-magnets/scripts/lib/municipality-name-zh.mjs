const CHAR_MAP = {
  恵: '惠',
  帯: '帶',
  広: '廣',
  沢: '澤',
  竜: '龍',
  豊: '豐',
  条: '條',
  塩: '鹽',
  万: '萬',
  芦: '蘆',
  黒: '黑',
  剣: '劍',
  軽: '輕',
  様: '樣',
  歳: '歲',
  実: '實',
  徳: '德',
  栄: '榮',
  渓: '溪',
  気: '氣',
  総: '總',
  県: '縣',
  斉: '齊',
  図: '圖',
  応: '應',
  絵: '繪',
  観: '觀',
  辺: '邊',
  桜: '櫻',
  瀬: '瀨',
  鉄: '鐵',
  霊: '靈',
  縄: '繩',
  国: '國',
  産: '產',
  斎: '齋',
  圏: '圈',
  ノ: '之',
};

const NAME_OVERRIDES = {
  えりも町: '襟裳町',
  せたな町: '瀨棚町',
  ニセコ町: '二世古町',
  むかわ町: '鵡川町',
  新ひだか町: '新日高町',
};

export function toMunicipalityNameZh(japaneseName) {
  if (NAME_OVERRIDES[japaneseName]) {
    return NAME_OVERRIDES[japaneseName];
  }

  return [...japaneseName].map((character) => CHAR_MAP[character] ?? character).join('');
}

export function buildNameZhLookup(records) {
  const lookup = new Map();

  for (const [id, name] of Object.entries(records)) {
    lookup.set(Number(id), name);
  }

  return lookup;
}

export function buildNameZhRecords(municipalities) {
  const records = {};

  for (const record of municipalities) {
    const city = record.city;
    records[record.lgcode] = toMunicipalityNameZh(city);
  }

  return records;
}
