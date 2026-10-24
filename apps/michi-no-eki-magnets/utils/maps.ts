import { Linking, Platform } from 'react-native';

import type { MapProvider } from '../types/mapProvider';
import type { NavigationPoint } from '../types/navigation';
import type { RouteRoadAvoidOptions } from './googleRoutes';

function openUrl(url: string) {
  Linking.openURL(url).catch(() => undefined);
}

function encodeQuery(value: string): string {
  return encodeURIComponent(value);
}

function hasCoordinates(point: Pick<NavigationPoint, 'latitude' | 'longitude'>): point is {
  latitude: number;
  longitude: number;
} {
  return point.latitude != null && point.longitude != null;
}

function formatCoordinates(latitude: number, longitude: number): string {
  return `${latitude},${longitude}`;
}

export type MapsRoutePoint = {
  latitude: number;
  longitude: number;
  /** Used as name@lat,lng for waypoints and destination (not origin). */
  label?: string;
  /** Google Place ID — used for a Places-selected origin (with coordinates). */
  placeId?: string;
  /**
   * When true, omit origin from the Google Maps URL so Maps uses the device's
   * "Your location" / 你的位置. Prefer this for "目前位置" origins.
   */
  useDeviceLocation?: boolean;
};

function buildGoogleMapsCoordinatesQuery(latitude: number, longitude: number): string {
  return encodeQuery(formatCoordinates(latitude, longitude));
}

/** Works for waypoints/destination in Google Maps directions; origin must not use this format. */
function buildGoogleMapsLabeledCoordinateQuery(
  latitude: number,
  longitude: number,
  label?: string,
): string {
  const trimmed = label?.trim();
  if (!trimmed) {
    return buildGoogleMapsCoordinatesQuery(latitude, longitude);
  }
  return encodeQuery(`${trimmed}@${formatCoordinates(latitude, longitude)}`);
}

function buildGoogleMapsDirectionsUrl(
  latitude: number,
  longitude: number,
  travelmode: 'driving' | 'transit',
): string {
  const destination = buildGoogleMapsCoordinatesQuery(latitude, longitude);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=${travelmode}`;
}

function buildGoogleMapsAvoidParam(roadAvoid?: RouteRoadAvoidOptions): string | null {
  if (!roadAvoid) {
    return null;
  }

  const parts: string[] = [];
  if (roadAvoid.avoidTolls) {
    parts.push('tolls');
  }
  if (roadAvoid.avoidHighways) {
    parts.push('highways');
  }

  return parts.length > 0 ? parts.join('%7C') : null;
}

export function buildGoogleMapsDrivingRouteUrl(
  origin: MapsRoutePoint,
  destination: MapsRoutePoint,
  waypoints: ReadonlyArray<MapsRoutePoint> = [],
  roadAvoid?: RouteRoadAvoidOptions,
): string {
  const destinationParam = buildGoogleMapsLabeledCoordinateQuery(
    destination.latitude,
    destination.longitude,
    destination.label,
  );
  let url = `https://www.google.com/maps/dir/?api=1&destination=${destinationParam}&travelmode=driving`;

  // Omit origin so Google Maps uses the live device location label ("你的位置").
  // name@lat,lng fails for origin specifically; coordinates-only shows "已放置圖釘".
  if (!origin.useDeviceLocation) {
    const originParam = buildGoogleMapsCoordinatesQuery(origin.latitude, origin.longitude);
    url += `&origin=${originParam}`;

    const originPlaceId = origin.placeId?.trim();
    if (originPlaceId) {
      url += `&origin_place_id=${encodeQuery(originPlaceId)}`;
    }
  }

  if (waypoints.length > 0) {
    const waypointParam = waypoints
      .map((point) =>
        buildGoogleMapsLabeledCoordinateQuery(point.latitude, point.longitude, point.label),
      )
      .join('%7C');
    url += `&waypoints=${waypointParam}`;
  }

  const avoidParam = buildGoogleMapsAvoidParam(roadAvoid);
  if (avoidParam) {
    url += `&avoid=${avoidParam}`;
  }

  return url;
}

export async function openMapsDrivingRoute(
  provider: MapProvider,
  origin: MapsRoutePoint,
  destination: MapsRoutePoint,
  waypoints: ReadonlyArray<MapsRoutePoint> = [],
  roadAvoid?: RouteRoadAvoidOptions,
) {
  const webUrl = buildGoogleMapsDrivingRouteUrl(origin, destination, waypoints, roadAvoid);

  if (waypoints.length === 0 && provider === 'apple') {
    const coords = formatCoordinates(destination.latitude, destination.longitude);
    const originCoords = formatCoordinates(origin.latitude, origin.longitude);
    openAppleMapsUrl(`http://maps.apple.com/?saddr=${originCoords}&daddr=${coords}&dirflg=d`);
    return;
  }

  openGoogleMapsUrl(webUrl);
}

function buildGoogleMapsPlaceUrl(latitude: number, longitude: number): string {
  const query = buildGoogleMapsCoordinatesQuery(latitude, longitude);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function buildGoogleMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeQuery(query)}`;
}

function openGoogleMapsUrl(webUrl: string) {
  openUrl(webUrl);
}

function openAppleMapsUrl(url: string) {
  openUrl(url);
}

function buildAppleMapsPlaceUrl(latitude: number, longitude: number): string {
  const coords = formatCoordinates(latitude, longitude);
  return `http://maps.apple.com/?ll=${coords}&q=${encodeQuery(coords)}`;
}

async function openDirections(
  provider: MapProvider,
  latitude: number,
  longitude: number,
  mode: 'driving' | 'transit',
) {
  const coords = formatCoordinates(latitude, longitude);

  if (provider === 'apple') {
    const dirflg = mode === 'transit' ? 'r' : 'd';
    openAppleMapsUrl(`http://maps.apple.com/?daddr=${coords}&dirflg=${dirflg}`);
    return;
  }

  if (Platform.OS === 'ios') {
    openGoogleMapsUrl(buildGoogleMapsPlaceUrl(latitude, longitude));
    return;
  }

  const travelmode = mode === 'transit' ? 'transit' : 'driving';
  const webUrl = buildGoogleMapsDirectionsUrl(latitude, longitude, travelmode);

  if (Platform.OS === 'android' && mode === 'driving') {
    openUrl(`google.navigation:q=${coords}&mode=d`);
    return;
  }

  openGoogleMapsUrl(webUrl);
}

async function openPlace(
  provider: MapProvider,
  latitude: number,
  longitude: number,
  label: string,
  googleLabel?: string,
) {
  const coords = formatCoordinates(latitude, longitude);

  if (provider === 'apple') {
    openAppleMapsUrl(buildAppleMapsPlaceUrl(latitude, longitude));
    return;
  }

  if (Platform.OS === 'android') {
    const queryLabel = googleLabel ?? label;
    openUrl(`geo:${coords}?q=${coords}(${encodeQuery(queryLabel)})`);
    return;
  }

  openGoogleMapsUrl(buildGoogleMapsPlaceUrl(latitude, longitude));
}

async function openSearch(provider: MapProvider, query: string) {
  if (provider === 'apple') {
    openAppleMapsUrl(`http://maps.apple.com/?q=${encodeQuery(query)}`);
    return;
  }

  openGoogleMapsUrl(buildGoogleMapsSearchUrl(query));
}

export async function openMapsNavigation(
  provider: MapProvider,
  latitude: number,
  longitude: number,
  _googleLabel?: string,
  mode: 'driving' | 'transit' = 'driving',
) {
  await openDirections(provider, latitude, longitude, mode);
}

export async function openGoogleMapsTransit(
  provider: MapProvider,
  latitude: number,
  longitude: number,
  _googleLabel?: string,
) {
  await openDirections(provider, latitude, longitude, 'transit');
}

export async function openMapsParkingNavigation(
  provider: MapProvider,
  point: NavigationPoint,
) {
  if (!hasCoordinates(point)) {
    return;
  }

  await openDirections(provider, point.latitude, point.longitude, 'driving');
}

export async function openMapsStampLocation(provider: MapProvider, point: NavigationPoint) {
  if (!hasCoordinates(point)) {
    return;
  }

  await openPlace(
    provider,
    point.latitude,
    point.longitude,
    point.label,
    point.googleLabel,
  );
}

export async function openMapsParkingSearch(provider: MapProvider, castleName: string) {
  await openSearch(provider, `${castleName} 駐車場`);
}
