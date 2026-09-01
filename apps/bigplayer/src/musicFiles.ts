import { Directory, File, Paths } from 'expo-file-system';
import { copyAsync } from 'expo-file-system/legacy';
import {
  filenameFromUri,
  tracksFromListing,
  uniqueFilename,
} from '../public/player-logic.mjs';

export type Track = { name: string; uri: string };

const FOLDER_GUIDE_NAME = '請把音樂放這裡.txt';
const FOLDER_GUIDE_TEXT = `請把歌曲放到這個資料夾。

支援：mp3、m4a、wav、mp4（只播聲音）

用 AirDrop 傳到 iPhone 後，在「檔案」裡移到：
我的 iPhone → 大字播
`;

function isFileEntry(entry: Directory | File): entry is File {
  return 'extension' in entry;
}

function dirUri(dir: Directory): string {
  return dir.uri.endsWith('/') ? dir.uri : `${dir.uri}/`;
}

function ensureMusicFolder(): Directory {
  const root = Paths.document;
  if (!root.exists) {
    root.create({ idempotent: true });
  }
  const guide = new File(root, FOLDER_GUIDE_NAME);
  if (!guide.exists) {
    guide.create();
    guide.write(FOLDER_GUIDE_TEXT);
  }
  return root;
}

export async function listDeviceTracks(): Promise<Track[]> {
  const root = ensureMusicFolder();
  const files = root.list().filter(isFileEntry);
  const byName = new Map(files.map((file) => [file.name, file.uri]));
  return tracksFromListing(dirUri(root), files.map((file) => file.name)).map((track) => ({
    name: track.name,
    uri: byName.get(track.name) ?? track.uri,
  }));
}

export async function ingestInbox(): Promise<void> {
  const root = ensureMusicFolder();
  const inbox = new Directory(root, 'Inbox');
  if (!inbox.exists) return;

  const existing = root.list().map((entry) => entry.name);
  for (const entry of inbox.list()) {
    if (!isFileEntry(entry)) continue;
    const destName = uniqueFilename(existing, entry.name);
    if (!destName) continue;
    await copyAsync({
      from: entry.uri,
      to: `${dirUri(root)}${destName}`,
    });
    entry.delete();
    existing.push(destName);
  }
}

export async function ingestExternalFile(sourceUri: string): Promise<string | null> {
  const root = ensureMusicFolder();
  const rootPrefix = dirUri(root);
  if (sourceUri.startsWith(rootPrefix) || sourceUri.startsWith(root.uri)) {
    return filenameFromUri(sourceUri);
  }

  const existing = root.list().map((entry) => entry.name);
  const destName = uniqueFilename(existing, filenameFromUri(sourceUri) ?? '');
  if (!destName) return null;
  await copyAsync({
    from: sourceUri,
    to: `${rootPrefix}${destName}`,
  });
  return destName;
}
