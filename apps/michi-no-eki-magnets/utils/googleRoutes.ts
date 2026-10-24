import { getGooglePlacesApiKey } from './googlePlacesConfig';
import { decodeEncodedPolyline } from './polyline';
import type { RouteEndpoint } from './routePlan';

const COMPUTE_ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

type ComputeRoutesResponse = {
  routes?: Array<{
    polyline?: {
      encodedPolyline?: string;
    };
  }>;
};

export class GoogleRoutesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleRoutesError';
  }
}

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

export type RouteRoadAvoidOptions = {
  avoidHighways: boolean;
  avoidTolls: boolean;
};

export const EMPTY_ROUTE_ROAD_AVOID_OPTIONS: RouteRoadAvoidOptions = {
  avoidHighways: false,
  avoidTolls: false,
};

function buildRouteModifiers(roadAvoid: RouteRoadAvoidOptions) {
  if (!roadAvoid.avoidHighways && !roadAvoid.avoidTolls) {
    return undefined;
  }

  return {
    avoidHighways: roadAvoid.avoidHighways,
    avoidTolls: roadAvoid.avoidTolls,
  };
}

export async function fetchDrivingRoutePolyline(
  origin: RouteEndpoint,
  destination: RouteEndpoint,
  roadAvoid: RouteRoadAvoidOptions = EMPTY_ROUTE_ROAD_AVOID_OPTIONS,
): Promise<RouteEndpoint[]> {
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) {
    throw new GoogleRoutesError('Google API key is not configured');
  }

  const routeModifiers = buildRouteModifiers(roadAvoid);

  const response = await fetch(COMPUTE_ROUTES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.polyline.encodedPolyline',
    },
    body: JSON.stringify({
      origin: buildLatLng(origin),
      destination: buildLatLng(destination),
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE',
      computeAlternativeRoutes: false,
      languageCode: 'zh-TW',
      units: 'METRIC',
      ...(routeModifiers ? { routeModifiers } : {}),
    }),
  });

  if (!response.ok) {
    throw new GoogleRoutesError(`Routes API failed (${response.status})`);
  }

  const payload = (await response.json()) as ComputeRoutesResponse;
  const encoded = payload.routes?.[0]?.polyline?.encodedPolyline?.trim();

  if (!encoded) {
    throw new GoogleRoutesError('Routes API returned no driving route');
  }

  const polyline = decodeEncodedPolyline(encoded);
  if (polyline.length < 2) {
    throw new GoogleRoutesError('Driving route polyline was too short');
  }

  return polyline;
}
