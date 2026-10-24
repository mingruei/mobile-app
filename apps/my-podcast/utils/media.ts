export const MIN_COMPLETE_BYTES = 8 * 1024;

export function parseDurationMillis(raw: string | null): number | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;
  if (/^\d+(\.\d+)?$/.test(text)) {
    const seconds = Number(text);
    if (!Number.isFinite(seconds) || seconds < 0) return null;
    return Math.round(seconds * 1000);
  }

  const parts = text.split(':').map((part) => Number(part));
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !Number.isFinite(part) || part < 0)) {
    return null;
  }
  const [hours, minutes, seconds] = parts.length === 3 ? parts : [0, parts[0], parts[1]];
  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
}

export function formatPlaybackTime(millis: number): string {
  const total = Math.max(0, Math.floor((Number.isFinite(millis) ? millis : 0) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${minutes}:${ss}`;
}

export function isDownloadComplete(bytes: number, expectedBytes: number | null): boolean {
  if (!Number.isFinite(bytes) || bytes < MIN_COMPLETE_BYTES) return false;
  if (expectedBytes == null || !Number.isFinite(expectedBytes) || expectedBytes < MIN_COMPLETE_BYTES) {
    return true;
  }
  return bytes >= Math.floor(expectedBytes * 0.98);
}

export function looksLikeAudio(header: ArrayLike<number>): boolean {
  if (header.length < 12) return false;
  const prefix = latin1(header, 0, 12);
  if (prefix.startsWith('ID3') || prefix.startsWith('fLaC') || prefix.startsWith('OggS') || prefix.startsWith('RIFF')) {
    return true;
  }
  if (latin1(header, 0, 32).includes('ftyp')) return true;
  return header[0] === 0xff && (header[1] & 0xe0) === 0xe0;
}

export function localFileIsPlayable(
  file: { exists: boolean; bytes: number },
  expectedBytes: number | null,
): boolean {
  return file.exists && isDownloadComplete(file.bytes, expectedBytes);
}

export function savedFileIsPlayable(
  file: { exists: boolean; bytes: number },
  savedBytes: number | null,
  expectedBytes: number | null,
): boolean {
  if (!file.exists || file.bytes < MIN_COMPLETE_BYTES) return false;
  if (savedBytes != null && Number.isFinite(savedBytes) && savedBytes >= MIN_COMPLETE_BYTES) {
    if (file.bytes >= Math.floor(savedBytes * 0.98)) return true;
  }
  return isDownloadComplete(file.bytes, expectedBytes);
}

function latin1(bytes: ArrayLike<number>, start: number, end: number): string {
  let text = '';
  const last = Math.min(end, bytes.length);
  for (let index = start; index < last; index += 1) {
    text += String.fromCharCode(bytes[index] ?? 0);
  }
  return text;
}
