import { Directory, File } from 'expo-file-system';
import {
  copyAsync,
  EncodingType,
  getInfoAsync,
  readAsStringAsync,
} from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { normalizeFileUri } from './normalizeFileUri';

function uniqueUriCandidates(sourceUri: string): string[] {
  return [normalizeFileUri(sourceUri), sourceUri.trim()].filter(
    (value, index, array) => value.length > 0 && array.indexOf(value) === index,
  );
}

function destinationUriCandidates(destinationUri: string): string[] {
  const normalized = normalizeFileUri(destinationUri);
  const candidates = [normalized, destinationUri.trim()];

  if (normalized.startsWith('file://')) {
    candidates.push(normalized.slice('file://'.length));
  }

  return candidates.filter(
    (value, index, array) => value.length > 0 && array.indexOf(value) === index,
  );
}

function joinDirectoryFile(directoryUri: string, filename: string): string {
  const base = directoryUri.endsWith('/') ? directoryUri : `${directoryUri}/`;
  return `${base}${filename}`;
}

async function getUriSize(uri: string): Promise<number> {
  try {
    const info = await getInfoAsync(uri);
    return info.exists ? (info.size ?? 0) : 0;
  } catch {
    return 0;
  }
}

function getFileByteLength(file: File): number {
  const reportedSize = file.info().size ?? 0;
  if (reportedSize > 0) {
    return reportedSize;
  }

  try {
    return file.bytesSync().length;
  } catch {
    return 0;
  }
}

export async function fileHasContent(file: File): Promise<boolean> {
  if (!file.exists) {
    return false;
  }

  if (getFileByteLength(file) > 0) {
    return true;
  }

  const reportedSize = await getUriSize(file.uri);
  if (reportedSize > 0) {
    return true;
  }

  try {
    const bytes = await file.bytes();
    return bytes.length > 0;
  } catch {
    const reportedSize = await getUriSize(file.uri);
    return reportedSize > 0;
  }
}

export function fileLikelyHasContent(file: File): boolean {
  if (!file.exists) {
    return false;
  }

  return getFileByteLength(file) > 0 || Platform.OS === 'android';
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function copyUriToDestination(sourceUri: string, destinationUri: string): Promise<boolean> {
  for (const source of uniqueUriCandidates(sourceUri)) {
    for (const destination of destinationUriCandidates(destinationUri)) {
      try {
        await copyAsync({
          from: source,
          to: destination,
        });

        const destinationFile = new File(normalizeFileUri(destinationUri));
        if (await fileHasContent(destinationFile)) {
          return true;
        }
      } catch {
        // Try the next URI format or fallback to byte copy.
      }
    }
  }

  return false;
}

async function readUriAsBase64Bytes(uri: string): Promise<Uint8Array> {
  for (const candidate of uniqueUriCandidates(uri)) {
    try {
      const base64 = await readAsStringAsync(candidate, { encoding: EncodingType.Base64 });
      if (base64.length > 0) {
        return decodeBase64(base64);
      }
    } catch {
      // Try the next URI format.
    }
  }

  throw new Error('Failed to read selected file');
}

export async function copySourceUriToFile(sourceUri: string, destination: File): Promise<void> {
  if (destination.exists) {
    destination.delete();
  }

  if (
    sourceUri.startsWith('content://') ||
    sourceUri.startsWith('file://') ||
    sourceUri.startsWith('/')
  ) {
    for (const source of uniqueUriCandidates(sourceUri)) {
      for (const dest of destinationUriCandidates(destination.uri)) {
        try {
          await copyAsync({
            from: source,
            to: dest,
          });

          if (fileLikelyHasContent(destination) || (await fileHasContent(destination))) {
            return;
          }
        } catch {
          // Try the next URI format or fallback to byte copy.
        }
      }
    }
  }

  await writeSourceToFile(sourceUri, destination);
}

export async function readBinaryFileBytes(file: File): Promise<Uint8Array> {
  if (!file.exists) {
    throw new Error('Failed to read selected file');
  }

  try {
    const syncBytes = file.bytesSync();
    if (syncBytes.length > 0) {
      return syncBytes;
    }
  } catch {
    // Fall back to async reads.
  }

  try {
    const asyncBytes = await file.bytes();
    if (asyncBytes.length > 0) {
      return asyncBytes;
    }
  } catch {
    // Fall back to legacy base64 reads.
  }

  for (const uri of uniqueUriCandidates(file.uri)) {
    try {
      const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
      if (base64.length > 0) {
        return decodeBase64(base64);
      }
    } catch {
      // Try the next URI format.
    }
  }

  throw new Error('Failed to read selected file');
}

export async function readSourceBytes(
  sourceUri: string,
  base64Data?: string | null,
): Promise<Uint8Array> {
  if (base64Data && base64Data.length > 0) {
    return decodeBase64(base64Data);
  }

  for (const uri of uniqueUriCandidates(sourceUri)) {
    try {
      const sourceFile = new File(uri);
      if (sourceFile.exists) {
        const bytes = await sourceFile.bytes();
        if (bytes.length > 0) {
          return bytes;
        }

        const syncBytes = getFileByteLength(sourceFile);
        if (syncBytes > 0) {
          return sourceFile.bytesSync();
        }
      }
    } catch {
      // Try the next URI format or fetch fallback.
    }

    if (Platform.OS === 'android') {
      try {
        const bytes = await readUriAsBase64Bytes(uri);
        if (bytes.length > 0) {
          return bytes;
        }
      } catch {
        // Try the next URI format.
      }
    }

    try {
      const response = await fetch(uri);
      if (!response.ok) {
        continue;
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > 0) {
        return bytes;
      }
    } catch {
      // Try the next URI format.
    }
  }

  throw new Error('Failed to read selected file');
}

export async function writeSourceToFile(
  sourceUri: string,
  destination: File,
  options?: { base64Data?: string | null },
): Promise<void> {
  if (options?.base64Data) {
    destination.write(decodeBase64(options.base64Data));
    if (!(await fileHasContent(destination))) {
      throw new Error('Failed to write selected file');
    }
    return;
  }

  if (
    sourceUri.startsWith('content://') ||
    sourceUri.startsWith('file://') ||
    sourceUri.startsWith('/')
  ) {
    const copied = await copyUriToDestination(sourceUri, destination.uri);
    if (copied) {
      return;
    }
  }

  const bytes = await readSourceBytes(sourceUri);
  destination.write(bytes);

  if (!(await fileHasContent(destination))) {
    throw new Error('Failed to write selected file');
  }
}

export async function writeSourceToNewFile(
  sourceUri: string,
  directory: Directory,
  filename: string,
  options?: { base64Data?: string | null },
): Promise<File> {
  const destinationUri = joinDirectoryFile(directory.uri, filename);
  const destination = new File(destinationUri);

  if (destination.exists) {
    destination.delete();
  }

  await writeSourceToFile(sourceUri, destination, options);

  if (!(await fileHasContent(destination))) {
    throw new Error('Failed to write selected file');
  }

  return destination;
}

export function getDisplayImageUri(uri: string): string {
  const trimmed = uri.trim();
  if (
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('ph://') ||
    trimmed.startsWith('assets-library://')
  ) {
    return trimmed;
  }

  if (trimmed.startsWith('/')) {
    return `file://${trimmed}`;
  }

  return trimmed;
}

export function isFileEntry(entry: Directory | File): entry is File {
  return 'extension' in entry;
}

export function isDirectoryEntry(entry: Directory | File): entry is Directory {
  return !isFileEntry(entry);
}
