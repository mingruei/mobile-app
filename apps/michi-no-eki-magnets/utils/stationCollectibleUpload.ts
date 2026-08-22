import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import DocumentScanner, {
  ResponseType,
  ScanDocumentResponseStatus,
} from 'react-native-document-scanner-plugin';

import {
  isCameraPermissionErrorMessage,
  isMediaPermissionErrorMessage,
} from './collectibleUploadErrors';
import { normalizeFileUri } from './normalizeFileUri';
import { waitForNativePicker } from './waitForNativePicker';

const DOCUMENT_PICKER_TIMEOUT_MS = 120_000;

const DOCUMENT_PICKER_TYPES =
  Platform.OS === 'ios'
    ? ([
        'public.image',
        'public.jpeg',
        'public.png',
        'public.heic',
        'com.adobe.pdf',
        'image/*',
        'application/pdf',
      ] as const)
    : (['image/*', 'application/pdf'] as const);

export type CollectibleUploadSource = 'scan' | 'file' | 'gallery' | 'camera';

export const DEFAULT_COLLECTIBLE_UPLOAD_SOURCES: CollectibleUploadSource[] = [
  'scan',
  'file',
  'gallery',
];

export type CollectibleUploadSelection = {
  uri: string;
  mimeType: string | null;
  width?: number | null;
  height?: number | null;
  base64?: string | null;
};

function toSelection(
  uri: string | undefined,
  mimeType?: string | null,
  width?: number | null,
  height?: number | null,
  base64?: string | null,
): CollectibleUploadSelection | null {
  if (!uri) {
    return null;
  }

  return {
    uri: normalizeFileUri(uri),
    mimeType: mimeType ?? null,
    width: width ?? null,
    height: height ?? null,
    base64: base64 ?? null,
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error ?? '');
}

async function ensureCameraPermission(): Promise<boolean> {
  const current = await ImagePicker.getCameraPermissionsAsync();
  if (current.granted) {
    return true;
  }

  const requested = await ImagePicker.requestCameraPermissionsAsync();
  return requested.granted;
}

async function ensureMediaLibraryPermission(): Promise<boolean> {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.granted) {
    return true;
  }

  const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return requested.granted;
}

async function withPickerTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('picker-timeout'));
    }, DOCUMENT_PICKER_TIMEOUT_MS);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function pickCollectibleFromScan(): Promise<CollectibleUploadSelection[]> {
  await waitForNativePicker();

  const cameraGranted = await ensureCameraPermission();
  if (!cameraGranted) {
    throw new Error('camera-permission-denied');
  }

  try {
    const { scannedImages, status } = await DocumentScanner.scanDocument({
      croppedImageQuality: 92,
      responseType: ResponseType.ImageFilePath,
    });

    if (status === ScanDocumentResponseStatus.Cancel || !scannedImages?.length) {
      return [];
    }

    return scannedImages
      .map((uri) => toSelection(uri, 'image/jpeg'))
      .filter((selection): selection is CollectibleUploadSelection => selection != null);
  } catch (error) {
    if (isCameraPermissionErrorMessage(toErrorMessage(error))) {
      throw new Error('camera-permission-denied');
    }
    throw error;
  }
}

export async function pickCollectibleFromCamera(): Promise<CollectibleUploadSelection[]> {
  await waitForNativePicker();

  const granted = await ensureCameraPermission();
  if (!granted) {
    throw new Error('camera-permission-denied');
  }

  try {
    const result = await withPickerTimeout(
      ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.92,
        allowsEditing: false,
        base64: Platform.OS === 'android',
      }),
    );

    if (result.canceled || !result.assets?.[0]) {
      return [];
    }

    const asset = result.assets[0];
    const selection = toSelection(
      asset.uri,
      asset.mimeType ?? 'image/jpeg',
      asset.width,
      asset.height,
      asset.base64,
    );
    return selection ? [selection] : [];
  } catch (error) {
    if (isCameraPermissionErrorMessage(toErrorMessage(error))) {
      throw new Error('camera-permission-denied');
    }
    throw error;
  }
}

export async function pickCollectibleFromGallery(): Promise<CollectibleUploadSelection[]> {
  await waitForNativePicker();

  const granted = await ensureMediaLibraryPermission();
  if (!granted) {
    throw new Error('media-permission-denied');
  }

  try {
    const result = await withPickerTimeout(
      ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: false,
        base64: Platform.OS === 'android',
      }),
    );

    if (result.canceled || !result.assets?.[0]) {
      return [];
    }

    const asset = result.assets[0];
    const selection = toSelection(
      asset.uri,
      asset.mimeType ?? 'image/jpeg',
      asset.width,
      asset.height,
      asset.base64,
    );
    return selection ? [selection] : [];
  } catch (error) {
    if (isMediaPermissionErrorMessage(toErrorMessage(error))) {
      throw new Error('media-permission-denied');
    }
    throw error;
  }
}

export async function pickCollectibleFromFile(): Promise<CollectibleUploadSelection[]> {
  await waitForNativePicker();

  const result = await withPickerTimeout(
    DocumentPicker.getDocumentAsync({
      type: [...DOCUMENT_PICKER_TYPES],
      copyToCacheDirectory: true,
      multiple: false,
    }),
  );

  if (result.canceled || !result.assets?.[0]) {
    return [];
  }

  const asset = result.assets[0];
  const selection = toSelection(asset.uri, asset.mimeType ?? null);
  return selection ? [selection] : [];
}

export async function pickCollectibleBySource(
  source: CollectibleUploadSource,
): Promise<CollectibleUploadSelection[]> {
  switch (source) {
    case 'scan':
      return pickCollectibleFromScan();
    case 'file':
      return pickCollectibleFromFile();
    case 'gallery':
      return pickCollectibleFromGallery();
    case 'camera':
      return pickCollectibleFromCamera();
  }
}
