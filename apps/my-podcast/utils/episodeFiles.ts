import { Directory, File, Paths } from 'expo-file-system';
import { createDownloadResumable, FileSystemSessionType } from 'expo-file-system/legacy';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { isDownloadComplete, looksLikeAudio, MIN_COMPLETE_BYTES, savedFileIsPlayable } from './media';

const ROOT = 'podcast-episodes';
const USER_AGENT = 'MyPodcast/1.0';
const KEEP_AWAKE_TAG = 'podcast-download';

let keepAwakeCount = 0;

function episodeDirectory(): Directory {
  const directory = new Directory(Paths.document, ROOT);
  if (!directory.exists) {
    directory.create({ idempotent: true });
  }
  return directory;
}

async function beginDownloadKeepAwake(): Promise<void> {
  keepAwakeCount += 1;
  if (keepAwakeCount !== 1) return;
  try {
    await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
  } catch {
    // Keep-awake is best-effort; background download still continues.
  }
}

function endDownloadKeepAwake(): void {
  keepAwakeCount = Math.max(0, keepAwakeCount - 1);
  if (keepAwakeCount === 0) {
    deactivateKeepAwake(KEEP_AWAKE_TAG);
  }
}

export function localFileSnapshot(filename: string): { exists: boolean; bytes: number } {
  const file = new File(episodeDirectory(), filename);
  if (!file.exists) return { exists: false, bytes: 0 };
  return { exists: true, bytes: file.size };
}

export function storedEpisodeIsOnDevice(
  stored: { filename: string; bytes: number } | null | undefined,
  expectedBytes: number | null,
): boolean {
  if (!stored) return false;
  const snapshot = localFileSnapshot(stored.filename);
  if (snapshot.exists && snapshot.bytes >= MIN_COMPLETE_BYTES) return true;
  return savedFileIsPlayable(snapshot, stored.bytes, expectedBytes);
}

export function localFileUri(filename: string): string | null {
  const file = new File(episodeDirectory(), filename);
  if (!file.exists) return null;
  return file.uri;
}

export function deleteEpisodeFile(filename: string): void {
  const directory = episodeDirectory();
  for (const name of [filename, `${filename}.partial`]) {
    const file = new File(directory, name);
    if (file.exists) file.delete();
  }
}

function readHeader(file: {
  open(): { readBytes(length: number): ArrayLike<number>; close(): void };
}): number[] {
  const handle = file.open();
  try {
    return Array.from(handle.readBytes(32));
  } finally {
    handle.close();
  }
}

export async function downloadEpisodeFile(input: {
  url: string;
  filename: string;
  expectedBytes: number | null;
  onProgress?: (progress: { written: number; expected: number | null }) => void;
}): Promise<{ filename: string; bytes: number; uri: string }> {
  const directory = episodeDirectory();
  const partial = new File(directory, `${input.filename}.partial`);
  if (partial.exists) partial.delete();

  await beginDownloadKeepAwake();
  try {
    input.onProgress?.({ written: 0, expected: input.expectedBytes });
    const task = createDownloadResumable(
      input.url,
      partial.uri,
      {
        headers: {
          Accept: '*/*',
          'User-Agent': USER_AGENT,
        },
        sessionType: FileSystemSessionType.BACKGROUND,
      },
      (data) => {
        const expectedFromNetwork =
          data.totalBytesExpectedToWrite > 0 ? data.totalBytesExpectedToWrite : null;
        input.onProgress?.({
          written: data.totalBytesWritten,
          expected: expectedFromNetwork ?? input.expectedBytes,
        });
      },
    );
    const result = await task.downloadAsync();
    if (!result?.uri || result.status < 200 || result.status >= 300) {
      if (partial.exists) partial.delete();
      throw new Error('incomplete');
    }

    const downloaded = new File(directory, `${input.filename}.partial`);
    if (!downloaded.exists) {
      throw new Error('incomplete');
    }

    let header: number[] = [];
    try {
      header = readHeader(downloaded);
    } catch {
      header = [];
    }

    if (!isDownloadComplete(downloaded.size, input.expectedBytes) || !looksLikeAudio(header)) {
      if (downloaded.exists) downloaded.delete();
      throw new Error('incomplete');
    }

    const destination = new File(directory, input.filename);
    if (destination.exists) destination.delete();
    downloaded.move(destination);
    return {
      filename: input.filename,
      bytes: destination.size,
      uri: destination.uri,
    };
  } finally {
    endDownloadKeepAwake();
  }
}
