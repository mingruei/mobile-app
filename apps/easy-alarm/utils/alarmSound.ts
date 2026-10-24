import { Audio, InterruptionModeIOS } from 'expo-av';
import { Vibration } from 'react-native';
import { clampVolume } from './alarmLogic';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const alarmAsset = require('../assets/alarm.wav') as number;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const keepAliveAsset = require('../assets/keepalive.wav') as number;

type SoundHandle = {
  stopAsync: () => Promise<unknown>;
  unloadAsync: () => Promise<unknown>;
};

let alarmSound: SoundHandle | null = null;
let keepAliveSound: SoundHandle | null = null;
let vibrateTimer: ReturnType<typeof setInterval> | null = null;

async function unload(handle: SoundHandle | null): Promise<void> {
  if (!handle) return;
  try {
    await handle.stopAsync();
  } catch {
    // already stopped
  }
  try {
    await handle.unloadAsync();
  } catch {
    // already unloaded
  }
}

export async function prepareAlarmAudio(mixWithOthers: boolean): Promise<void> {
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    interruptionModeIOS: mixWithOthers
      ? InterruptionModeIOS.MixWithOthers
      : InterruptionModeIOS.DoNotMix,
    playThroughEarpieceAndroid: false,
  });
}

export async function stopBackgroundKeepAlive(): Promise<void> {
  const current = keepAliveSound;
  keepAliveSound = null;
  await unload(current);
}

export async function startBackgroundKeepAlive(): Promise<void> {
  if (keepAliveSound || alarmSound) return;
  await prepareAlarmAudio(true);
  const created = await Audio.Sound.createAsync(keepAliveAsset, {
    isLooping: true,
    volume: 0.01,
    shouldPlay: true,
  });
  keepAliveSound = created.sound;
}

export async function startAlarmSound(volume: number): Promise<void> {
  await stopAlarmSound();
  await stopBackgroundKeepAlive();
  await prepareAlarmAudio(false);
  const created = await Audio.Sound.createAsync(alarmAsset, {
    isLooping: true,
    volume: clampVolume(volume),
    shouldPlay: true,
  });
  alarmSound = created.sound;
  Vibration.vibrate(400);
  vibrateTimer = setInterval(() => {
    Vibration.vibrate(400);
  }, 900);
}

export async function stopAlarmSound(): Promise<void> {
  if (vibrateTimer) {
    clearInterval(vibrateTimer);
    vibrateTimer = null;
  }
  Vibration.cancel();
  const current = alarmSound;
  alarmSound = null;
  await unload(current);
}

export async function previewAlarmSound(volume: number): Promise<void> {
  const resumeKeepAlive = keepAliveSound !== null;
  await startAlarmSound(volume);
  setTimeout(() => {
    void (async () => {
      await stopAlarmSound();
      if (resumeKeepAlive) await startBackgroundKeepAlive();
    })();
  }, 1600);
}
