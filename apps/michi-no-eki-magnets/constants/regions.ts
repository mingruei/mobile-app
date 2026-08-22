import { HOKKAIDO_AREA_IDS, isHokkaidoAreaId } from './hokkaidoAreas';
import { normalizePrefectureKey } from './prefectureKeys';

export type RegionId =
  | 'hokkaido'
  | 'tohoku'
  | 'kanto'
  | 'chubu'
  | 'kinki'
  | 'chugoku'
  | 'shikoku'
  | 'kyushu';

export type Region = {
  id: RegionId;
  prefectures: readonly string[];
};

export const REGIONS: readonly Region[] = [
  { id: 'hokkaido', prefectures: [...HOKKAIDO_AREA_IDS] },
  {
    id: 'tohoku',
    prefectures: ['青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'],
  },
  {
    id: 'kanto',
    prefectures: [
      '茨城県',
      '栃木県',
      '群馬県',
      '埼玉県',
      '千葉県',
      '東京都',
      '神奈川県',
    ],
  },
  {
    id: 'chubu',
    prefectures: [
      '新潟県',
      '富山県',
      '石川県',
      '福井県',
      '山梨県',
      '長野県',
      '岐阜県',
      '静岡県',
      '愛知県',
    ],
  },
  {
    id: 'kinki',
    prefectures: [
      '三重県',
      '滋賀県',
      '京都府',
      '大阪府',
      '兵庫県',
      '奈良県',
      '和歌山県',
    ],
  },
  {
    id: 'chugoku',
    prefectures: ['鳥取県', '島根県', '岡山県', '広島県', '山口県'],
  },
  {
    id: 'shikoku',
    prefectures: ['徳島県', '香川県', '愛媛県', '高知県'],
  },
  {
    id: 'kyushu',
    prefectures: [
      '福岡県',
      '佐賀県',
      '長崎県',
      '熊本県',
      '大分県',
      '宮崎県',
      '鹿児島県',
      '沖縄県',
    ],
  },
] as const;

const prefectureToRegion = new Map<string, RegionId>(
  REGIONS.flatMap((region) =>
    region.prefectures.map((prefecture) => [prefecture, region.id] as const),
  ),
);

prefectureToRegion.set('北海道', 'hokkaido');

export function getRegionIdForPrefecture(prefecture: string): RegionId | null {
  const normalized = normalizePrefectureKey(prefecture);
  if (isHokkaidoAreaId(normalized)) {
    return 'hokkaido';
  }

  return prefectureToRegion.get(normalized) ?? null;
}

export function getRegionById(regionId: RegionId): Region {
  const region = REGIONS.find((item) => item.id === regionId);
  if (!region) {
    throw new Error(`Unknown region: ${regionId}`);
  }
  return region;
}

export function getPrefecturesForRegion(
  regionId: RegionId,
  availablePrefectures: readonly string[],
): string[] {
  const regionPrefectures = new Set(getRegionById(regionId).prefectures);
  return availablePrefectures.filter((prefecture) => regionPrefectures.has(prefecture));
}
