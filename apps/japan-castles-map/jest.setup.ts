jest.mock('react-native-view-shot', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef(({ children }: { children: React.ReactNode }, _ref: unknown) => children),
    captureRef: jest.fn(async () => 'file:///tmp/mock-export.jpg'),
  };
});

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { latitude: 35.0116, longitude: 135.7681 },
  })),
  reverseGeocodeAsync: jest.fn(async () => [{ subregion: '京都府' }]),
}));

jest.mock('expo-image-picker', () => ({
  getCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));

jest.mock('react-native-document-scanner-plugin', () => ({
  __esModule: true,
  default: {
    scanDocument: jest.fn(async () => ({ status: 'cancel', scannedImages: [] })),
  },
  ResponseType: { ImageFilePath: 'imageFilePath' },
  ScanDocumentResponseStatus: { Cancel: 'cancel', Success: 'success' },
}));

jest.mock('expo-iap', () => ({
  ErrorCode: { UserCancelled: 'user-cancelled' },
  useIAP: jest.fn(() => ({
    connected: false,
    products: [],
    fetchProducts: jest.fn(async () => undefined),
    requestPurchase: jest.fn(async () => undefined),
    finishTransaction: jest.fn(async () => undefined),
  })),
}));
