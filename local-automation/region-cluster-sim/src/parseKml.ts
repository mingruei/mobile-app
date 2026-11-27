import type { SimPlace } from './types.ts';

export class KmlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KmlParseError';
  }
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tagContent(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = re.exec(block);
  if (!match?.[1]) return null;
  const decoded = decodeXmlEntities(match[1]);
  return decoded.length > 0 ? decoded : null;
}

function parseCoordinates(raw: string): { latitude: number; longitude: number } | null {
  const first = raw.trim().split(/\s+/)[0] ?? '';
  const parts = first.split(',');
  if (parts.length < 2) return null;
  const longitude = Number.parseFloat(parts[0]!);
  const latitude = Number.parseFloat(parts[1]!);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

function nearlySame(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): boolean {
  return Math.abs(a.latitude - b.latitude) < 1e-5 && Math.abs(a.longitude - b.longitude) < 1e-5;
}

export function parseKmlToSimPlaces(xml: string, maxPlaces = 40): SimPlace[] {
  const trimmed = xml?.trim() ?? '';
  if (!trimmed) throw new KmlParseError('KML 內容是空的');
  if (!/<kml\b/i.test(trimmed) && !/<placemark\b/i.test(trimmed)) {
    throw new KmlParseError('不是有效的 KML（找不到 kml／Placemark）');
  }

  const placemarkRe = /<placemark\b[^>]*>([\s\S]*?)<\/placemark>/gi;
  const raw: Array<{ name: string; latitude: number; longitude: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = placemarkRe.exec(trimmed)) != null) {
    const block = match[1] ?? '';
    const coordsRaw = tagContent(block, 'coordinates');
    if (!coordsRaw) continue;
    const pointBlock = /<point\b[^>]*>[\s\S]*?<\/point>/i.exec(block)?.[0];
    const coordsSource = pointBlock
      ? (tagContent(pointBlock, 'coordinates') ?? coordsRaw)
      : coordsRaw;
    if (!pointBlock && /<(linestring|polygon)\b/i.test(block)) continue;
    const coords = parseCoordinates(coordsSource);
    if (!coords) continue;
    if (raw.some((place) => nearlySame(place, coords))) continue;
    const name = tagContent(block, 'name') ?? `地點 ${raw.length + 1}`;
    raw.push({ name, latitude: coords.latitude, longitude: coords.longitude });
    if (raw.length >= maxPlaces) break;
  }

  if (raw.length === 0) {
    throw new KmlParseError('KML 裡沒有可匯入的地點（需要含座標的 Placemark）');
  }

  return raw.map((place, placeIndex) => ({
    placeIndex,
    label: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    hasCoords:
      Number.isFinite(place.latitude) &&
      Number.isFinite(place.longitude) &&
      !(place.latitude === 0 && place.longitude === 0),
  }));
}
