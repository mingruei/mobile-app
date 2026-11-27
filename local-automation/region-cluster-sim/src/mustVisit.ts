import type { MustVisitMatch, SimPlace } from './types.ts';

export type MustVisitResult = {
  matched: MustVisitMatch[];
  unmatched: string[];
  placeIndexes: Set<number>;
};

/**
 * Match must-visit patterns against place labels.
 * Special-case: 福岡城 must not match 旧福岡城門.
 */
export function matchMustVisit(
  places: readonly SimPlace[],
  patterns: readonly string[],
): MustVisitResult {
  const matched: MustVisitMatch[] = [];
  const unmatched: string[] = [];
  const placeIndexes = new Set<number>();

  for (const pattern of patterns) {
    const trimmed = pattern.trim();
    if (!trimmed) continue;

    let found: SimPlace | undefined;
    if (trimmed === '福岡城') {
      found = places.find((p) => /福岡城(?!門)/.test(p.label));
    } else {
      found = places.find((p) => p.label.includes(trimmed));
    }

    if (found) {
      matched.push({ pattern: trimmed, placeIndex: found.placeIndex, label: found.label });
      placeIndexes.add(found.placeIndex);
    } else {
      unmatched.push(trimmed);
    }
  }

  return { matched, unmatched, placeIndexes };
}
