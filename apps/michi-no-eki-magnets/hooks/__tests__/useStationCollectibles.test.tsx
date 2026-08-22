import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useStationCollectibles } from '../useStationCollectibles';
import {
  listStationCollectibles,
  saveStationCollectibleFromUri,
} from '../../utils/stationCollectibleStorage';
import { pickCollectibleBySource } from '../../utils/stationCollectibleUpload';
import { persistUploadImage } from '../../utils/persistUploadImage';

jest.mock('../../utils/stationCollectibleUpload', () => ({
  pickCollectibleBySource: jest.fn(),
}));

jest.mock('../../utils/stationCollectibleStorage', () => ({
  listStationCollectibles: jest.fn(() => []),
  saveStationCollectibleFromUri: jest.fn(async () => undefined),
  deleteStationCollectible: jest.fn(),
}));

jest.mock('../../utils/persistUploadImage', () => ({
  persistUploadImage: jest.fn(async (uri: string) => uri),
}));

jest.mock('../useStationProgress', () => ({
  useStationProgress: () => ({
    getProgress: jest.fn(() => ({
      visited: false,
      magnet: false,
      magnet: false,
      magnet: false,
      updatedAt: {
        visited: 0,
        magnet: 0,
        magnet: 0,
        magnet: 0,
      },
    })),
    markProgressCollected: jest.fn(),
  }),
}));

const mockedPick = pickCollectibleBySource as jest.MockedFunction<typeof pickCollectibleBySource>;
const mockedList = listStationCollectibles as jest.MockedFunction<typeof listStationCollectibles>;
const mockedSave = saveStationCollectibleFromUri as jest.MockedFunction<typeof saveStationCollectibleFromUri>;
const mockedPersist = persistUploadImage as jest.MockedFunction<typeof persistUploadImage>;

describe('useStationCollectibles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedList.mockReturnValue([]);
  });

  it('sets camera-permission-denied when upload permission fails', async () => {
    mockedPick.mockRejectedValue(new Error('camera-permission-denied'));

    const { result } = renderHook(() => useStationCollectibles(1, 'magnet'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.uploadFromSource('scan');
    });

    expect(result.current.error).toBe('camera-permission-denied');
    expect(result.current.uploading).toBe(false);
    expect(mockedSave).not.toHaveBeenCalled();
  });

  it('clears error and uploads when picker returns a selection', async () => {
    const savedItem = {
      id: '1:magnet:upload.jpg',
      stationId: 1,
      kind: 'magnet' as const,
      uri: 'file:///saved/upload.jpg',
      filename: 'upload.jpg',
      mimeType: 'image/jpeg',
      createdAt: 123,
    };

    mockedPick.mockResolvedValue([
      {
        uri: 'file:///tmp/upload.jpg',
        mimeType: 'image/jpeg',
        width: 800,
        height: 600,
        base64: null,
      },
    ]);
    mockedList
      .mockReturnValueOnce([]) // initial refresh
      .mockReturnValueOnce([]) // existingCount before save
      .mockReturnValueOnce([savedItem]) // savedItems verification
      .mockReturnValue([savedItem]); // final refresh

    const { result } = renderHook(() => useStationCollectibles(1, 'magnet'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.uploadFromSource('gallery');
    });

    expect(result.current.error).toBeNull();
    expect(mockedPersist).toHaveBeenCalled();
    expect(mockedSave).toHaveBeenCalled();
    expect(result.current.uploading).toBe(false);
  });

  it('does nothing when picker is cancelled', async () => {
    mockedPick.mockResolvedValue([]);

    const { result } = renderHook(() => useStationCollectibles(1, 'magnet'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.uploadFromSource('gallery');
    });

    expect(result.current.error).toBeNull();
    expect(mockedSave).not.toHaveBeenCalled();
    expect(result.current.uploading).toBe(false);
  });
});
