const EXTENSIONS = new Set(['mp3', 'm4a', 'aac', 'wav', 'ogg', 'flac']);

export function normalizeFeedUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

export function canonicalMediaUrl(input: string): string {
  try {
    const url = new URL(input);
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    const withoutHash = input.split('#')[0] ?? input;
    return withoutHash.split('?')[0] ?? withoutHash;
  }
}

function fnv1a(text: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function stableId(text: string): string {
  const left = fnv1a(text, 0x811c9dc5).toString(16).padStart(8, '0');
  const right = fnv1a(text, 0x811c9dc5 ^ 0x9e3779b9).toString(16).padStart(8, '0');
  return `${left}${right}`;
}

export function showIdForFeed(feedUrl: string): string {
  return `show_${stableId(normalizeFeedUrl(feedUrl) ?? feedUrl)}`;
}

export function episodeIdFor(guid: string | null, enclosureUrl: string): string {
  const key = guid?.trim() ? `guid:${guid.trim()}` : `url:${canonicalMediaUrl(enclosureUrl)}`;
  return `ep_${stableId(key)}`;
}

export function extensionForEpisode(type: string | null, enclosureUrl: string): string {
  const normalized = (type ?? '').toLowerCase();
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3';
  if (normalized.includes('mp4') || normalized.includes('m4a') || normalized.includes('aac')) return 'm4a';
  if (normalized.includes('wav')) return 'wav';
  if (normalized.includes('ogg') || normalized.includes('opus')) return 'ogg';
  if (normalized.includes('flac')) return 'flac';

  const path = canonicalMediaUrl(enclosureUrl);
  const ext = (path.split('.').pop() ?? '').toLowerCase();
  if (ext === 'm4b') return 'm4a';
  if (EXTENSIONS.has(ext)) return ext;
  return 'mp3';
}

export function episodeFilename(episodeId: string, extension: string): string {
  const safeExtension = EXTENSIONS.has(extension) ? extension : 'mp3';
  return `${episodeId}.${safeExtension}`;
}
