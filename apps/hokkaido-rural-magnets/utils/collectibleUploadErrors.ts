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
