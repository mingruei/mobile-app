import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Dimensions, InteractionManager, PixelRatio, Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type ViewShot from 'react-native-view-shot';

const CAPTURE_DELAY_MS = 600;

export function getExportCapturePixelWidth(): number {
  const { width } = Dimensions.get('window');
  return Math.round(width * PixelRatio.get());
}

export async function waitForExportLayout(): Promise<void> {
  await new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  });
  await new Promise((resolve) => setTimeout(resolve, CAPTURE_DELAY_MS));
}

type CaptureOptions = {
  format: 'jpg';
  quality: number;
  result: 'tmpfile';
  width?: number;
  useRenderInContext: boolean;
};

function buildCaptureOptions(
  captureWidth: number,
  useRenderInContext: boolean,
  withWidth: boolean,
): CaptureOptions {
  return {
    format: 'jpg',
    quality: 0.92,
    result: 'tmpfile',
    ...(withWidth ? { width: captureWidth } : {}),
    useRenderInContext,
  };
}

export async function waitForCaptureRef(
  viewRef: RefObject<ViewShot | null>,
  maxAttempts = 30,
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (viewRef.current) {
      return;
    }

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  throw new Error('export-view-unavailable');
}

export async function captureViewAsJpg(
  viewRef: RefObject<ViewShot | null>,
  captureWidth = getExportCapturePixelWidth(),
): Promise<string> {
  if (!viewRef.current) {
    throw new Error('export-view-unavailable');
  }

  await waitForExportLayout();

  const strategies =
    Platform.OS === 'ios'
      ? [
          buildCaptureOptions(captureWidth, true, true),
          buildCaptureOptions(captureWidth, false, true),
          buildCaptureOptions(captureWidth, true, false),
          buildCaptureOptions(captureWidth, false, false),
        ]
      : [
          buildCaptureOptions(captureWidth, false, true),
          buildCaptureOptions(captureWidth, false, false),
        ];

  let lastError: unknown;

  for (const options of strategies) {
    try {
      return await captureRef(viewRef, options);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('export-capture-failed');
}

export async function shareJpgFile(uri: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('sharing-unavailable');
  }

  const shareUri = uri.startsWith('file://') ? uri : `file://${uri}`;

  await Sharing.shareAsync(shareUri, {
    mimeType: 'image/jpeg',
    UTI: 'public.jpeg',
  });
}

export function resolveExportJpgError(error: unknown, t: (key: string) => string): string {
  const code = error instanceof Error ? error.message : '';

  switch (code) {
    case 'export-not-ready':
      return t('group.exportJpgNotReady');
    case 'export-view-unavailable':
    case 'export-ref-unavailable':
    case 'export-capture-failed':
      return t('group.exportJpgFailed');
    case 'sharing-unavailable':
      return t('group.exportJpgShareUnavailable');
    default:
      return t('group.exportJpgFailed');
  }
}
