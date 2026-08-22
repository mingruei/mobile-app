import castleContentZhHant from '../assets/i18n/castle-content.zh-Hant.json';
import type { Castle } from '../types/castle';
import type { CastleContentFields } from '../types/castleContent';
import type {
  CastleDrivingContent,
  CastlePublicTransitContent,
  NavigationPoint,
} from '../types/navigation';
import { extractCastleAliases } from '../utils/castleDisplayName';
import {
  getCastleParkingCoordinates,
  getCastleStampCoordinates,
} from '../utils/castleCoordinates';
import type { Locale, TranslationParams } from './types';

type CastleDrivingOverlay = {
  description?: string | null;
  parkingLocations?: NavigationPoint[];
  parkingLocation?: NavigationPoint;
};

type CastlePublicTransitOverlay = {
  description?: string;
  /** Japanese POI name for Google Maps (recommended over destinationLabel). */
  googleDestination?: string;
  destinationLabel?: string;
  destinationLatitude?: number;
  destinationLongitude?: number;
};

export type CastleContentOverlay = {
  subtitle?: string | null;
  alias?: string | null;
  description?: string;
  stampLocation?: string;
  stampLocations?: NavigationPoint[];
  castleCardLocations?: NavigationPoint[];
  massTransport?: string;
  driving?: CastleDrivingOverlay;
  publicTransit?: CastlePublicTransitOverlay;
};

let castleContentByLocale: Record<Locale, Record<string, CastleContentOverlay>> = {
  'zh-Hant': castleContentZhHant as Record<string, CastleContentOverlay>,
};

function rebuildCastleContentIndexes() {
  castleContentSubtitlesByCastleId = collectCastleContentSubtitles();
  castleContentAliasesByCastleId = collectCastleContentAliases();
}

export function setCastleContentForLocale(
  locale: Locale,
  content: Record<string, CastleContentOverlay>,
): void {
  castleContentByLocale = {
    ...castleContentByLocale,
    [locale]: content,
  };
  rebuildCastleContentIndexes();
}

function collectCastleContentSubtitles(): Readonly<Record<number, readonly string[]>> {
  const subtitlesByCastleId = new Map<number, Set<string>>();

  for (const localeContent of Object.values(castleContentByLocale)) {
    for (const [castleIdKey, overlay] of Object.entries(localeContent)) {
      const castleId = Number(castleIdKey);
      const subtitle = overlay.subtitle?.trim();

      if (!Number.isFinite(castleId) || !subtitle) {
        continue;
      }

      const subtitles = subtitlesByCastleId.get(castleId) ?? new Set<string>();
      subtitles.add(subtitle);
      subtitlesByCastleId.set(castleId, subtitles);
    }
  }

  return Object.fromEntries(
    [...subtitlesByCastleId.entries()].map(([castleId, subtitles]) => [castleId, [...subtitles]]),
  );
}

let castleContentSubtitlesByCastleId = collectCastleContentSubtitles();

export function hasCastleCardSalesLocation(castleId: number, locale: Locale = 'zh-Hant'): boolean {
  const overlay = castleContentByLocale[locale][String(castleId)];
  return (overlay?.castleCardLocations?.length ?? 0) > 0;
}

export function getCastleContentSubtitles(castleId: number): readonly string[] {
  return castleContentSubtitlesByCastleId[castleId] ?? [];
}

export function matchesCastleContentSubtitle(castleId: number, query: string): boolean {
  return getCastleContentSubtitles(castleId).some((subtitle) => subtitle.includes(query));
}

type TranslateFn = (key: string, params?: TranslationParams) => string;
type PrefectureLabelFn = (prefecture: string) => string;

function getLocationLabel(castle: Castle, getPrefectureLabel: PrefectureLabelFn): string {
  return `${getPrefectureLabel(castle.prefecture)}${castle.city}`;
}

function hasCoordinates(point: Pick<NavigationPoint, 'latitude' | 'longitude'>): boolean {
  return point.latitude != null && point.longitude != null;
}

function resolveStampLocations(
  castle: Castle,
  overlay: CastleContentOverlay,
  locationLabel: string,
  t: TranslateFn,
): NavigationPoint[] {
  if (overlay.stampLocations?.length) {
    return overlay.stampLocations;
  }

  const stampKey =
    castle.series === 'original'
      ? 'castle.stampLocationValueOriginal'
      : 'castle.stampLocationValueContinued';

  const fallbackLabel =
    overlay.stampLocation ??
    castle.stampLocation ??
    t(stampKey, { location: locationLabel });

  const stampCoordinates = getCastleStampCoordinates(castle);
  if (stampCoordinates) {
    return [
      {
        label: fallbackLabel,
        latitude: stampCoordinates.latitude,
        longitude: stampCoordinates.longitude,
      },
    ];
  }

  return [{ label: fallbackLabel }];
}

function resolveParkingLocations(
  castle: Castle,
  overlay: CastleContentOverlay,
): NavigationPoint[] {
  const overlayParking = [
    ...(overlay.driving?.parkingLocations ?? []),
    ...(overlay.driving?.parkingLocation ? [overlay.driving.parkingLocation] : []),
  ];

  if (overlayParking.length > 0) {
    return overlayParking;
  }

  const parkingCoordinates = getCastleParkingCoordinates(castle);
  if (parkingCoordinates) {
    return [
      {
        label: `${castle.name} 駐車場`,
        latitude: parkingCoordinates.latitude,
        longitude: parkingCoordinates.longitude,
      },
    ];
  }

  return [];
}

function resolveDrivingContent(
  castle: Castle,
  overlay: CastleContentOverlay,
): CastleDrivingContent {
  return {
    description: overlay.driving?.description ?? null,
    parkingLocations: resolveParkingLocations(castle, overlay),
  };
}

function resolvePublicTransitContent(
  castle: Castle,
  overlay: CastleContentOverlay,
  t: TranslateFn,
): CastlePublicTransitContent {
  const description =
    overlay.publicTransit?.description ??
    overlay.massTransport ??
    castle.massTransport ??
    castle.access ??
    t('castle.noMassTransport');

  return {
    description,
    destinationLatitude:
      overlay.publicTransit?.destinationLatitude ?? castle.latitude,
    destinationLongitude:
      overlay.publicTransit?.destinationLongitude ?? castle.longitude,
    destinationLabel:
      overlay.publicTransit?.googleDestination ??
      overlay.publicTransit?.destinationLabel ??
      castle.name,
  };
}

function collectCastleContentAliases(): Readonly<Record<number, string>> {
  const aliasesByCastleId = new Map<number, string>();

  for (const localeContent of Object.values(castleContentByLocale)) {
    for (const [castleIdKey, overlay] of Object.entries(localeContent)) {
      const castleId = Number(castleIdKey);
      const alias = resolveCastleAlias(overlay);

      if (!Number.isFinite(castleId) || !alias) {
        continue;
      }

      aliasesByCastleId.set(castleId, alias);
    }
  }

  return Object.fromEntries(aliasesByCastleId.entries());
}

let castleContentAliasesByCastleId = collectCastleContentAliases();

export function getCastleContentAlias(castleId: number): string | null {
  return castleContentAliasesByCastleId[castleId] ?? null;
}

export function matchesCastleContentAlias(castleId: number, query: string): boolean {
  const alias = getCastleContentAlias(castleId);
  return alias != null && alias.includes(query);
}

function resolveCastleAlias(overlay: CastleContentOverlay): string | null {
  const explicitAlias = overlay.alias?.trim();
  if (explicitAlias) {
    return explicitAlias;
  }

  if (!overlay.description) {
    return null;
  }

  return extractCastleAliases(overlay.description);
}

function resolveZhHantContent(
  castle: Castle,
  t: TranslateFn,
  getPrefectureLabel: PrefectureLabelFn,
): CastleContentFields {
  const overlay = castleContentByLocale['zh-Hant'][String(castle.id)] ?? {};
  const locationLabel = getLocationLabel(castle, getPrefectureLabel);
  const displayName = overlay.subtitle?.trim() || castle.name;

  return {
    locationLabel,
    displayName,
    alias: resolveCastleAlias(overlay),
    subtitle: overlay.subtitle ?? null,
    description:
      overlay.description ??
      (castle.series === 'continued'
        ? t('castle.continuedDescription', { location: locationLabel })
        : t('castle.noDescription')),
    stampLocations: resolveStampLocations(castle, overlay, locationLabel, t),
    castleCardLocations: overlay.castleCardLocations ?? [],
    driving: resolveDrivingContent(castle, overlay),
    publicTransit: resolvePublicTransitContent(castle, overlay, t),
  };
}

function resolveDefaultContent(
  castle: Castle,
  t: TranslateFn,
  getPrefectureLabel: PrefectureLabelFn,
): CastleContentFields {
  const locationLabel = getLocationLabel(castle, getPrefectureLabel);
  const stampLabel =
    castle.stampLocation ?? t('castle.noStampLocation');

  const stampCoordinates = getCastleStampCoordinates(castle);
  const stampLocations: NavigationPoint[] = stampCoordinates
    ? [
        {
          label: stampLabel,
          latitude: stampCoordinates.latitude,
          longitude: stampCoordinates.longitude,
        },
      ]
    : [{ label: stampLabel }];

  const parkingCoordinates = getCastleParkingCoordinates(castle);
  const parkingLocations: NavigationPoint[] = parkingCoordinates
    ? [
        {
          label: `${castle.name} 駐車場`,
          latitude: parkingCoordinates.latitude,
          longitude: parkingCoordinates.longitude,
        },
      ]
    : [];

  return {
    locationLabel,
    displayName: castle.name,
    alias: null,
    subtitle: castle.nameEn ?? null,
    description: castle.shortDescription ?? castle.history ?? t('castle.noDescription'),
    stampLocations,
    castleCardLocations: [],
    driving: {
      description: null,
      parkingLocations,
    },
    publicTransit: {
      description:
        castle.massTransport ?? castle.access ?? t('castle.noMassTransport'),
      destinationLatitude: castle.latitude,
      destinationLongitude: castle.longitude,
      destinationLabel: castle.name,
    },
  };
}

export function resolveCastleContent(
  castle: Castle,
  locale: Locale,
  t: TranslateFn,
  getPrefectureLabel: PrefectureLabelFn,
): CastleContentFields {
  if (locale === 'zh-Hant') {
    return resolveZhHantContent(castle, t, getPrefectureLabel);
  }

  return resolveDefaultContent(castle, t, getPrefectureLabel);
}

export { hasCoordinates };
