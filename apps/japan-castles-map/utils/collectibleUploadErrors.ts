export function isCameraPermissionErrorMessage(error: string): boolean {
  if (error === 'camera-permission-denied') {
    return true;
  }

  const normalized = error.toLowerCase();
  return (
    normalized.includes('camera') &&
    (normalized.includes('permission') ||
      normalized.includes('denied') ||
      normalized.includes('not authorized'))
  );
}

export function isPickerCancelledErrorMessage(error: string): boolean {
  if (error === 'picker-cancelled') {
    return true;
  }

  const normalized = error.toLowerCase();
  return (
    normalized.includes('cancelled') ||
    normalized.includes('canceled') ||
    normalized.includes('user cancel') ||
    normalized.includes('was cancelled') ||
    normalized.includes('was canceled') ||
    normalized.includes('user closed') ||
    normalized.includes('no document') ||
    normalized.includes('dismissed')
  );
}

export function isMediaPermissionErrorMessage(error: string): boolean {
  if (error === 'media-permission-denied') {
    return true;
  }

  const normalized = error.toLowerCase();
  const mentionsPhotos =
    normalized.includes('photo') ||
    normalized.includes('media library') ||
    normalized.includes('gallery');

  return (
    mentionsPhotos &&
    (normalized.includes('permission') ||
      normalized.includes('denied') ||
      normalized.includes('not authorized'))
  );
}
