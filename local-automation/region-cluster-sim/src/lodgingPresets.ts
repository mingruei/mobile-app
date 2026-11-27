import type { CorridorAnchor, LodgingNight, LodgingSchedule } from './types.ts';

export const AIRPORT_PRESETS: Record<string, CorridorAnchor> = {
  oita: {
    label: '大分機場',
    latitude: 33.4794,
    longitude: 131.7372,
  },
  saga: {
    label: '佐賀機場',
    latitude: 33.1497,
    longitude: 130.3022,
  },
  fukuoka: {
    label: '福岡機場',
    latitude: 33.5859,
    longitude: 130.4507,
  },
};

export type LodgingFixture = {
  tripStart?: string | CorridorAnchor | null;
  tripEnd?: string | CorridorAnchor | null;
  nights: Array<{
    dayIndex: number;
    label: string;
    latitude: number;
    longitude: number;
  }>;
};

function resolveAnchor(
  value: string | CorridorAnchor | null | undefined,
): CorridorAnchor | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const preset = AIRPORT_PRESETS[value.toLowerCase()];
    if (!preset) {
      throw new Error(`Unknown airport preset: ${value}`);
    }
    return preset;
  }
  return value;
}

export function lodgingScheduleFromFixture(fixture: LodgingFixture): LodgingSchedule {
  const nights: LodgingNight[] = fixture.nights.map((night) => ({
    dayIndex: night.dayIndex,
    lodging: {
      label: night.label,
      latitude: night.latitude,
      longitude: night.longitude,
    },
  }));
  return {
    nights,
    tripStart: resolveAnchor(fixture.tripStart),
    tripEnd: resolveAnchor(fixture.tripEnd),
  };
}

export function resolveAirportPreset(key: string): CorridorAnchor {
  const preset = AIRPORT_PRESETS[key.toLowerCase()];
  if (!preset) throw new Error(`Unknown airport preset: ${key}`);
  return preset;
}
