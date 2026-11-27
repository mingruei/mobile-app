import { loadGoogleMapsKeyFromEnvFiles } from './loadEnv.ts';

const COMPUTE_ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

type ComputeRoutesResponse = {
  routes?: Array<{
    duration?: string;
    distanceMeters?: number;
  }>;
};

export class GoogleRoutesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleRoutesError';
  }
}

export type RouteEndpoint = {
  latitude: number;
  longitude: number;
};

export type RouteLegResult = {
  durationSeconds: number;
  distanceMeters: number;
  fetchedAt: string;
};

export type FetchRouteLegOptions = {
  apiKey?: string | null;
  avoidTolls?: boolean;
};

function buildLatLng(location: RouteEndpoint) {
  return {
    location: {
      latLng: {
        latitude: location.latitude,
        longitude: location.longitude,
      },
    },
  };
}

/** Parse Google duration string like "3723s" into seconds. */
export function parseDurationSeconds(duration: string | undefined): number | null {
  if (!duration) return null;
  const match = /^(\d+(?:\.\d+)?)s$/.exec(duration.trim());
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? Math.round(value) : null;
}

export function isSameRoutePoint(a: RouteEndpoint, b: RouteEndpoint): boolean {
  return (
    Math.abs(a.latitude - b.latitude) < 1e-5 &&
    Math.abs(a.longitude - b.longitude) < 1e-5
  );
}

/**
 * Thin Routes client for the offline sim (no Expo deps).
 * Aligns with travel-plan fetchRouteLeg: drive + TRAFFIC_UNAWARE.
 */
export async function fetchRouteLeg(
  origin: RouteEndpoint,
  destination: RouteEndpoint,
  options?: FetchRouteLegOptions,
): Promise<RouteLegResult> {
  if (isSameRoutePoint(origin, destination)) {
    return {
      durationSeconds: 0,
      distanceMeters: 0,
      fetchedAt: new Date().toISOString(),
    };
  }

  const apiKey = options?.apiKey ?? loadGoogleMapsKeyFromEnvFiles();
  if (!apiKey) {
    throw new GoogleRoutesError(
      'Google API key is not configured (EXPO_PUBLIC_GOOGLE_PLACES_API_KEY)',
    );
  }

  const avoidTolls = options?.avoidTolls === true;
  const body: Record<string, unknown> = {
    origin: buildLatLng(origin),
    destination: buildLatLng(destination),
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_UNAWARE',
    computeAlternativeRoutes: false,
    languageCode: 'zh-TW',
    units: 'METRIC',
  };
  if (avoidTolls) {
    body.routeModifiers = { avoidTolls: true };
  }

  const response = await fetch(COMPUTE_ROUTES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new GoogleRoutesError(
      `Routes API failed (${response.status})${text ? `: ${text.slice(0, 200)}` : ''}`,
    );
  }

  const payload = (await response.json()) as ComputeRoutesResponse;
  const route = payload.routes?.[0];
  const durationSeconds = parseDurationSeconds(route?.duration);
  const distanceMeters = route?.distanceMeters;

  if (durationSeconds == null || typeof distanceMeters !== 'number') {
    throw new GoogleRoutesError('Routes API returned no route duration');
  }

  return {
    durationSeconds,
    distanceMeters,
    fetchedAt: new Date().toISOString(),
  };
}
