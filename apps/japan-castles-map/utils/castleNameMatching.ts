import type { Castle } from '../types/castle';

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[・·\-ー\s]/g, '');
}

export function filterCastlesByQuery(
  castles: readonly Castle[],
  query: string,
): Castle[] {
  const normalizedQuery = normalizeForMatch(query);
  if (!normalizedQuery) {
    return [];
  }

  return castles.filter((castle) => {
    const name = normalizeForMatch(castle.name);
    const englishName = castle.nameEn ? normalizeForMatch(castle.nameEn) : '';
    const location = normalizeForMatch(castle.location);
    const prefecture = normalizeForMatch(castle.prefecture);
    const number = String(castle.number);

    return (
      name.includes(normalizedQuery) ||
      englishName.includes(normalizedQuery) ||
      location.includes(normalizedQuery) ||
      prefecture.includes(normalizedQuery) ||
      number === normalizedQuery ||
      number.startsWith(normalizedQuery)
    );
  });
}
