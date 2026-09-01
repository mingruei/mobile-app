import {
  DEFAULT_VOLUME,
  SAVE_INTERVAL_MS,
  STORAGE_KEY,
  clampPlaybackTime,
  clampVolume,
  displayName,
  findResumeIndex,
  formatClock,
  nextIndex,
  parseSavedState,
  prevIndex,
  serializeState,
  stepVolume,
  volumePercent,
} from "./player-logic.mjs";

const titleEl = document.getElementById("song-title");
const metaEl = document.getElementById("song-meta");
const clockEl = document.getElementById("clock");
const fillEl = document.getElementById("progress-fill");
const statusEl = document.getElementById("status");
const volumeLabelEl = document.getElementById("volume-label");
const phoneUrlEl = document.getElementById("phone-url");
const helpEl = document.getElementById("help");
const startOverlayEl = document.getElementById("start-overlay");

const audio = new Audio();
audio.preload = "auto";
audio.playsInline = true;
audio.setAttribute("playsinline", "");
audio.setAttribute("webkit-playsinline", "");

const state = {
  tracks: [],
  index: 0,
  volume: DEFAULT_VOLUME,
  resumeTime: 0,
  closed: false,
  saveTimer: 0,
};

function currentTrack() {
  return state.tracks[state.index] ?? null;
}

function readSaved() {
  return parseSavedState(localStorage.getItem(STORAGE_KEY));
}

function saveNow(playing = !audio.paused && !audio.ended) {
  const track = currentTrack();
  localStorage.setItem(
    STORAGE_KEY,
    serializeState({
      file: track?.name ?? null,
      time: audio.currentTime || state.resumeTime || 0,
      volume: state.volume,
      playing: state.closed ? false : playing,
    }),
  );
}

function setStatus(text) {
  statusEl.textContent = text;
}

function render() {
  const track = currentTrack();
  const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  const current = audio.currentTime || 0;
  titleEl.textContent = track ? displayName(track.name) : "還沒有歌曲";
  metaEl.textContent = track
    ? `第 ${state.index + 1} 首，共 ${state.tracks.length} 首`
    : "等候歌曲";
  clockEl.textContent = `${formatClock(current)} / ${formatClock(duration)}`;
  fillEl.style.width = duration > 0 ? `${Math.min(100, (current / duration) * 100)}%` : "0%";
  volumeLabelEl.textContent = volumePercent(state.volume);
}

function applyVolume() {
  audio.volume = clampVolume(state.volume);
  render();
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("無法讀取 " + url);
  return res.json();
}

async function loadPlaylist() {
  const data = await fetchJson("/api/playlist");
  return Array.isArray(data.tracks) ? data.tracks : [];
}

function loadTrack({ index, time = 0, autoplay = true }) {
  if (!state.tracks.length) {
    audio.removeAttribute("src");
    render();
    return;
  }

  state.index = ((index % state.tracks.length) + state.tracks.length) % state.tracks.length;
  const track = currentTrack();
  state.resumeTime = clampPlaybackTime(time, Number.POSITIVE_INFINITY);
  audio.src = track.url;
  audio.load();

  const onMeta = () => {
    audio.currentTime = clampPlaybackTime(state.resumeTime, audio.duration);
    state.resumeTime = audio.currentTime;
    render();
    if (autoplay && !state.closed) {
      play().catch(showStartOverlay);
    }
  };
  audio.addEventListener("loadedmetadata", onMeta, { once: true });
  render();
}

async function play() {
  if (!state.tracks.length) {
    setStatus("還沒有歌曲");
    return Promise.reject(new Error("empty"));
  }
  state.closed = false;
  startOverlayEl.classList.add("hidden");
  applyVolume();
  await audio.play();
  setStatus("正在播放");
  saveNow(true);
}

function pause() {
  audio.pause();
  setStatus("已暫停");
  saveNow(false);
}

function closePlayer() {
  pause();
  state.closed = true;
  saveNow(false);
  window.close();
}

function showStartOverlay() {
  startOverlayEl.classList.remove("hidden");
  setStatus("請按「開始播放」");
}

function changeTrack(index, { autoplay = true } = {}) {
  loadTrack({ index, time: 0, autoplay });
}

async function refreshPlaylist({ preserve = true } = {}) {
  const previousName = currentTrack()?.name;
  const tracks = await loadPlaylist();
  state.tracks = tracks;

  if (!tracks.length) {
    render();
    setStatus("還沒有歌曲");
    return;
  }

  if (preserve && previousName) {
    const index = findResumeIndex(tracks, previousName);
    if (tracks[index]?.name === previousName) {
      state.index = index;
      render();
      return;
    }
  }

  const saved = readSaved();
  const index = findResumeIndex(tracks, saved?.file);
  loadTrack({
    index,
    time: tracks[index]?.name === saved?.file ? saved?.time ?? 0 : 0,
    autoplay: true,
  });
}

async function loadPhoneUrl() {
  try {
    const info = await fetchJson("/api/info");
    const remote = (info.urls || []).find((url) => !url.includes("127.0.0.1"));
    if (remote) {
      phoneUrlEl.textContent = `手機請打開：${remote}`;
      phoneUrlEl.classList.remove("hidden");
      helpEl.classList.remove("hidden");
    }
  } catch {
    /* ignore */
  }
}

document.getElementById("btn-close").addEventListener("click", closePlayer);
document.getElementById("btn-next").addEventListener("click", () => {
  changeTrack(nextIndex(state.index, state.tracks.length));
});
document.getElementById("btn-prev").addEventListener("click", () => {
  changeTrack(prevIndex(state.index, state.tracks.length));
});
document.getElementById("btn-vol-up").addEventListener("click", () => {
  state.volume = stepVolume(state.volume, 1);
  applyVolume();
  saveNow();
});
document.getElementById("btn-vol-down").addEventListener("click", () => {
  state.volume = stepVolume(state.volume, -1);
  applyVolume();
  saveNow();
});
document.getElementById("btn-start").addEventListener("click", () => {
  play().catch(() => setStatus("無法播放，請再按一次"));
});

audio.addEventListener("timeupdate", () => {
  render();
});
audio.addEventListener("ended", () => {
  changeTrack(nextIndex(state.index, state.tracks.length), { autoplay: true });
});
audio.addEventListener("play", () => setStatus("正在播放"));
audio.addEventListener("pause", () => {
  if (state.closed) setStatus("已關閉");
});
let errorStreak = 0;
audio.addEventListener("playing", () => {
  errorStreak = 0;
});
audio.addEventListener("error", () => {
  errorStreak += 1;
  if (!state.tracks.length || errorStreak >= state.tracks.length) {
    setStatus("這些歌曲都無法播放");
    return;
  }
  setStatus("這首歌無法播放，改播下一首");
  changeTrack(nextIndex(state.index, state.tracks.length), { autoplay: true });
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    audio.pause();
    saveNow(false);
    return;
  }
  if (!state.closed) {
    play().catch(showStartOverlay);
  }
});
window.addEventListener("pagehide", () => {
  audio.pause();
  saveNow(false);
});
window.addEventListener("beforeunload", () => saveNow(false));

const saved = readSaved();
state.volume = saved?.volume ?? DEFAULT_VOLUME;
applyVolume();
state.saveTimer = window.setInterval(() => {
  if (!audio.paused) saveNow(true);
}, SAVE_INTERVAL_MS);

refreshPlaylist({ preserve: false }).catch(() => {
  setStatus("無法讀取歌曲清單，請重新打開");
});
loadPhoneUrl();
setInterval(() => {
  refreshPlaylist({ preserve: true }).catch(() => {});
}, 8000);
