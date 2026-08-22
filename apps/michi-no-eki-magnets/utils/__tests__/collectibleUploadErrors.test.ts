import {
  isCameraPermissionErrorMessage,
  isMediaPermissionErrorMessage,
} from '../collectibleUploadErrors';

describe('collectibleUploadErrors', () => {
  describe('isCameraPermissionErrorMessage', () => {
    it('matches explicit error code', () => {
      expect(isCameraPermissionErrorMessage('camera-permission-denied')).toBe(true);
    });

    it('matches native permission denial messages', () => {
      expect(isCameraPermissionErrorMessage('User denied access to the camera')).toBe(true);
      expect(isCameraPermissionErrorMessage('Camera permission not authorized')).toBe(true);
    });

    it('ignores unrelated errors', () => {
      expect(isCameraPermissionErrorMessage('picker-timeout')).toBe(false);
      expect(isCameraPermissionErrorMessage('camera unavailable')).toBe(false);
      expect(isCameraPermissionErrorMessage('Failed to save collectible')).toBe(false);
      expect(isMediaPermissionErrorMessage('camera-permission-denied')).toBe(false);
    });
  });

  describe('isMediaPermissionErrorMessage', () => {
    it('matches explicit error code', () => {
      expect(isMediaPermissionErrorMessage('media-permission-denied')).toBe(true);
    });

    it('matches native photo library denial messages', () => {
      expect(isMediaPermissionErrorMessage('Photo library access denied')).toBe(true);
      expect(isMediaPermissionErrorMessage('Permission to access media library not authorized')).toBe(
        true,
      );
      expect(isMediaPermissionErrorMessage('gallery permission denied')).toBe(true);
    });

    it('ignores unrelated errors', () => {
      expect(isMediaPermissionErrorMessage('picker-timeout')).toBe(false);
      expect(isMediaPermissionErrorMessage('photo upload failed')).toBe(false);
      expect(isCameraPermissionErrorMessage('media-permission-denied')).toBe(false);
    });
  });
});
