import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CastleGroup } from '../types/castleGroup';

const STORAGE_KEY = 'castle.groups.v1';

function isCastleGroup(value: unknown): value is CastleGroup {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<CastleGroup>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.castleIds) &&
    candidate.castleIds.every((id) => typeof id === 'number') &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.updatedAt === 'string'
  );
}

export async function loadCastleGroups(): Promise<CastleGroup[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isCastleGroup);
  } catch {
    return [];
  }
}

export async function saveCastleGroups(groups: readonly CastleGroup[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
}

export function normalizeCastleGroups(raw: unknown): CastleGroup[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter(isCastleGroup);
}

export function createCastleGroupId(): string {
  return `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
