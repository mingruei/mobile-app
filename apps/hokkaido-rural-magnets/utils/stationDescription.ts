import type { Station } from '../types/station';

export function getStationShortDescription(station: Station): string | null {
  const zh = station.shortDescriptionZh?.trim();
  if (zh) {
    return zh;
  }

  const ja = station.shortDescription?.trim();
  return ja || null;
}
