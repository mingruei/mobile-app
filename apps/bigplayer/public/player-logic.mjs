export const AUDIO_EXTENSIONS = [".mp3", ".m4a", ".aac", ".wav", ".flac", ".mp4"];

export const VIDEO_CONTAINER_EXTENSIONS = [".mp4"];

export const STORAGE_KEY = "bigplayer-state-v1";

export const VOLUME_STEP = 0.1;
export const MIN_VOLUME = 0;
export const MAX_VOLUME = 1;
export const DEFAULT_VOLUME = 0.5;
export const SAVE_INTERVAL_MS = 2000;

export function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), "zh-Hant", {
    numeric: true,
    sensitivity: "base",
  });
}

export function sortTrackNames(names) {
  return [...names].sort(naturalCompare);
}

export function extensionOf(filename) {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return "";
  return filename.slice(dot).toLowerCase();
}

export function isAudioFilename(filename) {
  return AUDIO_EXTENSIONS.includes(extensionOf(filename));
}

export function isVideoContainerFilename(filename) {
  return VIDEO_CONTAINER_EXTENSIONS.includes(extensionOf(filename));
}

export function shouldShowVideoSurface(isTablet = false) {
  return Boolean(isTablet);
}

export function shouldUseVideoPlayer(filename, isTablet = false) {
  return Boolean(isTablet) && isVideoContainerFilename(filename);
}

export function isLandscapeLayout(width, height) {
  return Number(width) > Number(height);
}

export function filesFolderLabel(isTablet = false) {
  return isTablet ? "我的 iPad" : "我的 iPhone";
}

export function isCompactPhoneLayout(width, height, isTablet = false) {
  if (isTablet) return false;
  const short = Math.min(Number(width), Number(height));
  const long = Math.max(Number(width), Number(height));
  return short <= 375 && long < 700;
}

export function displayName(filename) {
  const ext = extensionOf(filename);
  if (!ext) return filename;
  return filename.slice(0, -ext.length);
}

export function sanitizeFilename(name) {
  if (typeof name !== "string" || !name.trim()) return null;
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "";
  if (!base || base === "." || base === ".." || base.startsWith(".")) return null;
  if (!isAudioFilename(base)) return null;
  const ext = extensionOf(base);
  const stem = base
    .slice(0, -ext.length)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  if (!stem) return null;
  return stem + ext;
}

export function clampVolume(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_VOLUME;
  return Math.min(MAX_VOLUME, Math.max(MIN_VOLUME, n));
}

export function stepVolume(current, direction) {
  const next = clampVolume(current) + direction * VOLUME_STEP;
  return Math.round(clampVolume(next) * 10) / 10;
}

export function nextIndex(index, length) {
  if (length <= 0) return 0;
  return (index + 1) % length;
}

export function prevIndex(index, length) {
  if (length <= 0) return 0;
  return (index - 1 + length) % length;
}

export function findResumeIndex(tracks, savedFile) {
  if (!savedFile || !Array.isArray(tracks) || tracks.length === 0) return 0;
  const index = tracks.findIndex((track) => track.name === savedFile);
  return index >= 0 ? index : 0;
}

export function clampPlaybackTime(time, duration) {
  const t = Number(time);
  if (!Number.isFinite(t) || t < 0) return 0;
  if (Number.isFinite(duration) && duration > 0) {
    return Math.min(t, Math.max(0, duration - 0.25));
  }
  return t;
}

export function parseSavedState(raw) {
  if (!raw) return null;
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!data || typeof data !== "object") return null;
    return {
      file: typeof data.file === "string" ? data.file : null,
      time: Number.isFinite(Number(data.time)) ? Number(data.time) : 0,
      volume: clampVolume(data.volume),
      playing: data.playing !== false,
    };
  } catch {
    return null;
  }
}

export function serializeState({ file, time, volume, playing }) {
  return JSON.stringify({
    file: file ?? null,
    time: clampPlaybackTime(time, Number.POSITIVE_INFINITY),
    volume: clampVolume(volume),
    playing: Boolean(playing),
  });
}

export function formatClock(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n < 0) return "0:00";
  const total = Math.floor(n);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const mm = hours > 0 ? String(mins).padStart(2, "0") : String(mins);
  const ss = String(secs).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function volumePercent(volume) {
  return `${Math.round(clampVolume(volume) * 100)}%`;
}

export function uniqueFilename(existingNames, desiredName) {
  const safe = sanitizeFilename(desiredName);
  if (!safe) return null;
  const existing = new Set(existingNames);
  if (!existing.has(safe)) return safe;
  const ext = extensionOf(safe);
  const stem = safe.slice(0, -ext.length);
  let n = 2;
  let candidate = `${stem} ${n}${ext}`;
  while (existing.has(candidate)) {
    n += 1;
    candidate = `${stem} ${n}${ext}`;
  }
  return candidate;
}

export function tracksFromListing(dirUri, names) {
  return sortTrackNames(
    names.filter((name) => name !== "Inbox" && !name.startsWith(".") && isAudioFilename(name)),
  ).map((name) => ({
    name,
    uri: dirUri + name,
  }));
}

export function filenameFromUri(uri) {
  if (typeof uri !== "string" || !uri) return null;
  const cleaned = uri.split("?")[0].split("#")[0];
  try {
    return decodeURIComponent(cleaned.replace(/\\/g, "/").split("/").pop() ?? "");
  } catch {
    return cleaned.replace(/\\/g, "/").split("/").pop() ?? null;
  }
}
