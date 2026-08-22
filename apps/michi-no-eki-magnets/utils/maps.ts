import { Linking, Platform } from 'react-native';

import type { MapProvider } from '../types/mapProvider';
import type { NavigationPoint } from '../types/navigation';

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

/** Google Maps queries use coordinates so 道の駅 names are not geocoded to the wrong place. */
function buildGoogleMapsCoordinatesQuery(latitude: number, longitude: number): string {
  return encodeQuery(formatCoordinates(latitude, longitude));
}

function buildGoogleMapsDirectionsUrl(
  latitude: number,
  longitude: number,
  travelmode: 'driving' | 'transit',
): string {
  const destination = buildGoogleMapsCoordinatesQuery(latitude, longitude);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=${travelmode}`;
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
