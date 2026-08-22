import type { Station } from '../types/station';

export function getStationDisplayName(station: Station): string {
  const zh = station.nameZh?.trim();
  if (zh) {
    return zh;
  }

  return station.name;
}

export function getStationLocation(station: Station): string {
  return `北海道${getStationDisplayName(station)}`;
}

export function getStationNameSubtitle(station: Station): string | null {
  const parts: string[] = [];

  if (station.name !== getStationDisplayName(station)) {
    parts.push(station.name);
  }

  if (station.nameEn?.trim()) {
    parts.push(station.nameEn.trim());
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

export function getStationListSecondaryLine(station: Station): string {
  const parts = [getStationDisplayName(station)];

  if (station.nameEn?.trim()) {
    parts.push(station.nameEn.trim());
  }

  return parts.join(' · ');
}
