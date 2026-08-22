jest.mock('../waitForNativePicker', () => ({
  waitForNativePicker: jest.fn(async () => undefined),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import DocumentScanner, {
  ScanDocumentResponseStatus,
} from 'react-native-document-scanner-plugin';

import {
  pickCollectibleBySource,
  pickCollectibleFromCamera,
  pickCollectibleFromFile,
  pickCollectibleFromGallery,
  pickCollectibleFromScan,
} from '../stationCollectibleUpload';

const mockedImagePicker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const mockedDocumentPicker = DocumentPicker as jest.Mocked<typeof DocumentPicker>;
const mockedScanner = DocumentScanner as jest.Mocked<typeof DocumentScanner>;

describe('stationCollectibleUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedImagePicker.getCameraPermissionsAsync.mockResolvedValue({ granted: true } as never);
    mockedImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true } as never);
    mockedImagePicker.getMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as never);
    mockedImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as never);
  });

  describe('pickCollectibleFromScan', () => {
    it('throws camera-permission-denied when camera access is rejected', async () => {
      mockedImagePicker.getCameraPermissionsAsync.mockResolvedValue({ granted: false } as never);
      mockedImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false } as never);

      await expect(pickCollectibleFromScan()).rejects.toThrow('camera-permission-denied');
    });

    it('returns empty array when scan is cancelled', async () => {
      mockedScanner.scanDocument.mockResolvedValue({
        status: ScanDocumentResponseStatus.Cancel,
        scannedImages: [],
      } as never);

      await expect(pickCollectibleFromScan()).resolves.toEqual([]);
    });

    it('returns scanned image selections', async () => {
      mockedScanner.scanDocument.mockResolvedValue({
        status: ScanDocumentResponseStatus.Success,
        scannedImages: ['/tmp/scan.jpg'],
      } as never);

      await expect(pickCollectibleFromScan()).resolves.toEqual([
        expect.objectContaining({
          uri: 'file:///tmp/scan.jpg',
          mimeType: 'image/jpeg',
        }),
      ]);
    });

    it('normalizes native camera permission errors', async () => {
      mockedScanner.scanDocument.mockRejectedValue(new Error('User denied access to the camera'));

      await expect(pickCollectibleFromScan()).rejects.toThrow('camera-permission-denied');
    });
  });

  describe('pickCollectibleFromCamera', () => {
    it('throws camera-permission-denied when camera access is rejected', async () => {
      mockedImagePicker.getCameraPermissionsAsync.mockResolvedValue({ granted: false } as never);
      mockedImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false } as never);

      await expect(pickCollectibleFromCamera()).rejects.toThrow('camera-permission-denied');
    });

    it('returns selected camera photo', async () => {
      mockedImagePicker.launchCameraAsync.mockResolvedValue({
        canceled: false,
        assets: [
          {
            uri: 'file:///tmp/camera.jpg',
            mimeType: 'image/jpeg',
            width: 1200,
            height: 1600,
          },
        ],
      } as never);

      await expect(pickCollectibleFromCamera()).resolves.toEqual([
        expect.objectContaining({
          uri: 'file:///tmp/camera.jpg',
          mimeType: 'image/jpeg',
          width: 1200,
          height: 1600,
        }),
      ]);
    });
  });

  describe('pickCollectibleFromGallery', () => {
    it('throws media-permission-denied when photo access is rejected', async () => {
      mockedImagePicker.getMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false } as never);
      mockedImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false } as never);

      await expect(pickCollectibleFromGallery()).rejects.toThrow('media-permission-denied');
    });

    it('returns empty array when gallery picker is cancelled', async () => {
      mockedImagePicker.launchImageLibraryAsync.mockResolvedValue({
        canceled: true,
        assets: null,
      } as never);

      await expect(pickCollectibleFromGallery()).resolves.toEqual([]);
    });

    it('returns selected gallery asset', async () => {
      mockedImagePicker.launchImageLibraryAsync.mockResolvedValue({
        canceled: false,
        assets: [
          {
            uri: 'file:///tmp/gallery.jpg',
            mimeType: 'image/jpeg',
            width: 800,
            height: 600,
          },
        ],
      } as never);

      await expect(pickCollectibleFromGallery()).resolves.toEqual([
        expect.objectContaining({
          uri: 'file:///tmp/gallery.jpg',
          mimeType: 'image/jpeg',
          width: 800,
          height: 600,
        }),
      ]);
    });
  });

  describe('pickCollectibleFromFile', () => {
    it('returns empty array when document picker is cancelled', async () => {
      mockedDocumentPicker.getDocumentAsync.mockResolvedValue({
        canceled: true,
        assets: [],
      } as never);

      await expect(pickCollectibleFromFile()).resolves.toEqual([]);
    });

    it('returns selected document asset', async () => {
      mockedDocumentPicker.getDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [
          {
            uri: 'file:///tmp/card.pdf',
            mimeType: 'application/pdf',
          },
        ],
      } as never);

      await expect(pickCollectibleFromFile()).resolves.toEqual([
        expect.objectContaining({
          uri: 'file:///tmp/card.pdf',
          mimeType: 'application/pdf',
        }),
      ]);
    });
  });

  describe('pickCollectibleBySource', () => {
    it('routes to the requested source picker', async () => {
      mockedDocumentPicker.getDocumentAsync.mockResolvedValue({
        canceled: true,
        assets: [],
      } as never);

      await pickCollectibleBySource('file');
      expect(mockedDocumentPicker.getDocumentAsync).toHaveBeenCalled();
    });

    it('routes to camera picker', async () => {
      mockedImagePicker.launchCameraAsync.mockResolvedValue({
        canceled: true,
        assets: null,
      } as never);

      await pickCollectibleBySource('camera');
      expect(mockedImagePicker.launchCameraAsync).toHaveBeenCalled();
    });
  });
});
