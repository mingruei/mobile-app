import * as Sharing from 'expo-sharing';
import { Dimensions, InteractionManager, PixelRatio, Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import {
  captureViewAsJpg,
  getExportCapturePixelWidth,
  resolveExportJpgError,
  shareJpgFile,
  waitForCaptureRef,
  waitForExportLayout,
} from '../exportGroupShowImage';

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

const mockedCaptureRef = captureRef as jest.MockedFunction<typeof captureRef>;
const mockedSharing = Sharing as jest.Mocked<typeof Sharing>;

describe('exportGroupShowImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    };
    jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation((callback) => {
      callback();
      return { cancel: jest.fn() };
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('computes capture width from window dimensions', () => {
    jest.spyOn(Dimensions, 'get').mockReturnValue({
      width: 390,
      height: 844,
      scale: 3,
      fontScale: 1,
    });
    jest.spyOn(PixelRatio, 'get').mockReturnValue(3);

    expect(getExportCapturePixelWidth()).toBe(1170);
  });

  it('waits for export layout to settle', async () => {
    const promise = waitForExportLayout();
    await jest.runAllTimersAsync();
    await expect(promise).resolves.toBeUndefined();
  });

  it('waits until capture ref becomes available', async () => {
    const viewRef = { current: null as object | null };
    const promise = waitForCaptureRef(viewRef, 3);

    viewRef.current = {};
    await expect(promise).resolves.toBeUndefined();
  });

  it('throws when capture ref never becomes available', async () => {
    const viewRef = { current: null };

    await expect(waitForCaptureRef(viewRef, 2)).rejects.toThrow('export-view-unavailable');
  });

  it('captures a view as jpg after layout settles', async () => {
    mockedCaptureRef.mockResolvedValue('file:///tmp/export.jpg');
    const viewRef = { current: {} };

    const promise = captureViewAsJpg(viewRef, 1170);
    await jest.runAllTimersAsync();
    await expect(promise).resolves.toBe('file:///tmp/export.jpg');

    expect(mockedCaptureRef).toHaveBeenCalledWith(viewRef, {
      format: 'jpg',
      quality: 0.92,
      result: 'tmpfile',
      width: 1170,
      useRenderInContext: Platform.OS === 'ios',
    });
  });

  it('retries capture with alternate strategies when the first attempt fails', async () => {
    mockedCaptureRef
      .mockRejectedValueOnce(new Error('drawViewHierarchyInRect was not successful'))
      .mockResolvedValueOnce('file:///tmp/export.jpg');
    const viewRef = { current: {} };

    const promise = captureViewAsJpg(viewRef, 1170);
    await jest.runAllTimersAsync();
    await expect(promise).resolves.toBe('file:///tmp/export.jpg');
    expect(mockedCaptureRef).toHaveBeenCalledTimes(2);
  });

  it('throws when the view ref is missing', async () => {
    const viewRef = { current: null };

    await expect(captureViewAsJpg(viewRef, 1170)).rejects.toThrow('export-view-unavailable');
  });

  it('throws when every capture strategy fails', async () => {
    mockedCaptureRef.mockRejectedValue(new Error('capture-failed'));
    const viewRef = { current: {} };

    const promise = captureViewAsJpg(viewRef, 1170);
    const assertion = expect(promise).rejects.toThrow('capture-failed');
    await jest.runAllTimersAsync();
    await assertion;
    expect(mockedCaptureRef.mock.calls.length).toBeGreaterThan(1);
  });

  it('uses fewer capture strategies on Android', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    mockedCaptureRef.mockResolvedValue('file:///tmp/export-android.jpg');
    const viewRef = { current: {} };

    const promise = captureViewAsJpg(viewRef, 1080);
    await jest.runAllTimersAsync();
    await expect(promise).resolves.toBe('file:///tmp/export-android.jpg');
    expect(mockedCaptureRef).toHaveBeenCalledTimes(1);
    expect(mockedCaptureRef).toHaveBeenCalledWith(viewRef, {
      format: 'jpg',
      quality: 0.92,
      result: 'tmpfile',
      width: 1080,
      useRenderInContext: false,
    });
  });

  it('shares a jpg file when sharing is available', async () => {
    await shareJpgFile('file:///tmp/export.jpg');

    expect(mockedSharing.shareAsync).toHaveBeenCalledWith('file:///tmp/export.jpg', {
      mimeType: 'image/jpeg',
      UTI: 'public.jpeg',
    });
  });

  it('normalizes share uri when file prefix is missing', async () => {
    await shareJpgFile('/tmp/export.jpg');

    expect(mockedSharing.shareAsync).toHaveBeenCalledWith('file:///tmp/export.jpg', {
      mimeType: 'image/jpeg',
      UTI: 'public.jpeg',
    });
  });

  it('throws when sharing is unavailable', async () => {
    mockedSharing.isAvailableAsync.mockResolvedValueOnce(false);

    await expect(shareJpgFile('file:///tmp/export.jpg')).rejects.toThrow('sharing-unavailable');
  });

  it('maps export errors to user-facing messages', () => {
    const t = (key: string) => key;

    expect(resolveExportJpgError(new Error('export-not-ready'), t)).toBe(
      'group.exportJpgNotReady',
    );
    expect(resolveExportJpgError(new Error('export-view-unavailable'), t)).toBe(
      'group.exportJpgFailed',
    );
    expect(resolveExportJpgError(new Error('export-capture-failed'), t)).toBe(
      'group.exportJpgFailed',
    );
    expect(resolveExportJpgError(new Error('sharing-unavailable'), t)).toBe(
      'group.exportJpgShareUnavailable',
    );
    expect(resolveExportJpgError('unexpected', t)).toBe('group.exportJpgFailed');
  });
});
