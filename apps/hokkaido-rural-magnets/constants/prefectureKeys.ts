import { zhHant } from '../i18n/locales/zh-Hant';

const zhHantToJapanesePrefecture = new Map<string, string>(
  Object.entries(zhHant.prefectures).map(([japanese, traditional]) => [
    traditional,
    japanese,
  ]),
);

/** Map station JSON prefecture values to the Japanese keys used by region filters. */
export function normalizePrefectureKey(prefecture: string): string {
  return zhHantToJapanesePrefecture.get(prefecture) ?? prefecture;
}
