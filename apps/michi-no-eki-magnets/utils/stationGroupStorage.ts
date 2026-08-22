import AsyncStorage from '@react-native-async-storage/async-storage';

import type { StationGroup } from '../types/stationGroup';

const STORAGE_KEY = 'station.groups.v1';

function isStationGroup(value: unknown): value is StationGroup {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<StationGroup>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.stationIds) &&
    candidate.stationIds.every((id) => typeof id === 'number') &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.updatedAt === 'string'
  );
}

export async function loadStationGroups(): Promise<StationGroup[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isStationGroup);
  } catch {
    return [];
  }
}

export async function saveStationGroups(groups: readonly StationGroup[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
}

export function normalizeStationGroups(raw: unknown): StationGroup[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter(isStationGroup);
}

export function createStationGroupId(): string {
  return `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
