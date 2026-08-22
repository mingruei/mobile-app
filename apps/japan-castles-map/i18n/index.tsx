import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { normalizePrefectureKey } from '../constants/prefectureKeys';
import { zhHant } from './locales/zh-Hant';
import type { Locale, TranslationDictionary, TranslationParams } from './types';
import type { RegionId } from '../constants/regions';
import type { CastleSeries } from '../types/castle';

const DEFAULT_LOCALE: Locale = 'zh-Hant';

const dictionaries: Record<Locale, TranslationDictionary> = {
  'zh-Hant': zhHant,
};

function getNestedValue(dictionary: TranslationDictionary, key: string): string | undefined {
  const value = key.split('.').reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object' && segment in current) {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, dictionary);

  return typeof value === 'string' ? value : undefined;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params[name] ?? ''));
}

type I18nContextValue = {
  locale: Locale;
  t: (key: string, params?: TranslationParams) => string;
  getRegionLabel: (regionId: RegionId) => string;
  getPrefectureLabel: (prefecture: string) => string;
  getSeriesLabel: (series: CastleSeries, full?: boolean) => string;
  formatCount: (count: number) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

type I18nProviderProps = {
  children: ReactNode;
  locale?: Locale;
};

export function I18nProvider({ children, locale = DEFAULT_LOCALE }: I18nProviderProps) {
  const value = useMemo<I18nContextValue>(() => {
    const dictionary = dictionaries[locale];

    const t = (key: string, params?: TranslationParams) => {
      const template = getNestedValue(dictionary, key);
      if (!template) {
        return key;
      }
      return interpolate(template, params);
    };

    return {
      locale,
      t,
      getRegionLabel: (regionId) => dictionary.regions[regionId],
      getPrefectureLabel: (prefecture) =>
        dictionary.prefectures[normalizePrefectureKey(prefecture)] ?? prefecture,
      getSeriesLabel: (series, full = false) => {
        if (series === 'original') {
          return full ? dictionary.castle.seriesOriginalFull : dictionary.castle.seriesOriginal;
        }
        return full ? dictionary.castle.seriesContinuedFull : dictionary.castle.seriesContinued;
      },
      formatCount: (count) => `${count} 座`,
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}

export { DEFAULT_LOCALE };
