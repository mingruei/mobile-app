declare module '*player-logic.mjs' {
  export const STORAGE_KEY: string;
  export const SAVE_INTERVAL_MS: number;
  export const DEFAULT_VOLUME: number;
  export function displayName(filename: string): string;
  export function clampPlaybackTime(time: number, duration: number): number;
  export function clampVolume(value: unknown): number;
  export function findResumeIndex(tracks: { name: string }[], savedFile: string | null): number;
  export function formatClock(seconds: number): string;
  export function nextIndex(index: number, length: number): number;
  export function prevIndex(index: number, length: number): number;
  export function parseSavedState(raw: string | null): {
    file: string | null;
    time: number;
    volume: number;
    playing: boolean;
  } | null;
  export function serializeState(state: {
    file: string | null;
    time: number;
    volume: number;
    playing: boolean;
  }): string;
  export function stepVolume(current: number, direction: number): number;
  export function volumePercent(volume: number): string;
  export function uniqueFilename(existingNames: string[], desiredName: string): string | null;
  export function tracksFromListing(
    dirUri: string,
    names: string[],
  ): { name: string; uri: string }[];
  export function filenameFromUri(uri: string): string | null;
  export function sanitizeFilename(name: string): string | null;
  export function isAudioFilename(filename: string): boolean;
  export function isVideoContainerFilename(filename: string): boolean;
  export function shouldShowVideoSurface(isTablet?: boolean): boolean;
  export function shouldUseVideoPlayer(filename: string, isTablet?: boolean): boolean;
  export function isLandscapeLayout(width: number, height: number): boolean;
  export function filesFolderLabel(isTablet?: boolean): string;
  export function isCompactPhoneLayout(
    width: number,
    height: number,
    isTablet?: boolean,
  ): boolean;
}
