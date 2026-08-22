import type { Station } from '../types/station';

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[・·\-ー\s]/g, '');
}

export function filterStationsByQuery(
  stations: readonly Station[],
  query: string,
): Station[] {
  const normalizedQuery = normalizeForMatch(query);
  if (!normalizedQuery) {
    return [];
  }

  return stations.filter((station) => {
    const name = normalizeForMatch(station.name);
    const englishName = station.nameEn ? normalizeForMatch(station.nameEn) : '';
    const location = normalizeForMatch(station.location);
    const prefecture = normalizeForMatch(station.prefecture);

    return (
      name.includes(normalizedQuery) ||
      englishName.includes(normalizedQuery) ||
      location.includes(normalizedQuery) ||
      prefecture.includes(normalizedQuery)
    );
  });
}
