import type { RouteEndpoint } from './routePlan';

/** Decodes Google's encoded polyline (precision 1e5). */
export function decodeEncodedPolyline(encoded: string): RouteEndpoint[] {
  const points: RouteEndpoint[] = [];
  let index = 0;
  let latitudeE5 = 0;
  let longitudeE5 = 0;

  while (index < encoded.length) {
    const latitudeResult = readPolylineComponent(encoded, index);
    index = latitudeResult.nextIndex;
    latitudeE5 += latitudeResult.value;

    const longitudeResult = readPolylineComponent(encoded, index);
    index = longitudeResult.nextIndex;
    longitudeE5 += longitudeResult.value;

    points.push({
      latitude: latitudeE5 / 1e5,
      longitude: longitudeE5 / 1e5,
    });
  }

  return points;
}

function readPolylineComponent(
  encoded: string,
  startIndex: number,
): { value: number; nextIndex: number } {
  let index = startIndex;
  let shift = 0;
  let result = 0;
  let byte = 0;

  do {
    byte = encoded.charCodeAt(index++) - 63;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);

  const value = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
  return { value, nextIndex: index };
}

export function simplifyPolyline(
  points: readonly RouteEndpoint[],
  maxVertices = 250,
): RouteEndpoint[] {
  if (points.length <= maxVertices) {
    return [...points];
  }

  const simplified: RouteEndpoint[] = [];
  const lastIndex = points.length - 1;

  for (let vertexIndex = 0; vertexIndex < maxVertices; vertexIndex += 1) {
    const sourceIndex = Math.round((vertexIndex / (maxVertices - 1)) * lastIndex);
    simplified.push(points[sourceIndex]!);
  }

  return simplified;
}
