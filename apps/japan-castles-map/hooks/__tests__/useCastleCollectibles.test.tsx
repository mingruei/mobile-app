import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useCastleCollectibles } from '../useCastleCollectibles';
import {
  listCastleCollectibles,
  saveCastleCollectibleFromUri,
} from '../../utils/castleCollectibleStorage';
import { pickCollectibleBySource } from '../../utils/castleCollectibleUpload';
import { persistUploadImage } from '../../utils/persistUploadImage';

jest.mock('../../utils/castleCollectibleUpload', () => ({
  pickCollectibleBySource: jest.fn(),
}));

jest.mock('../../utils/castleCollectibleStorage', () => ({
  listCastleCollectibles: jest.fn(() => []),
  saveCastleCollectibleFromUri: jest.fn(async () => undefined),
  deleteCastleCollectible: jest.fn(),
}));

jest.mock('../../utils/persistUploadImage', () => ({
  persistUploadImage: jest.fn(async (uri: string) => uri),
}));

jest.mock('../useCastleProgress', () => ({
  useCastleProgress: () => ({
    getProgress: jest.fn(() => ({
      visited: false,
      meijoStamp: false,
      goshuin: false,
      castleCard: false,
      updatedAt: {
        visited: 0,
        meijoStamp: 0,
        goshuin: 0,
        castleCard: 0,
      },
    })),
    markProgressCollected: jest.fn(),
  }),
}));

const mockedPick = pickCollectibleBySource as jest.MockedFunction<typeof pickCollectibleBySource>;
const mockedList = listCastleCollectibles as jest.MockedFunction<typeof listCastleCollectibles>;
const mockedSave = saveCastleCollectibleFromUri as jest.MockedFunction<typeof saveCastleCollectibleFromUri>;
const mockedPersist = persistUploadImage as jest.MockedFunction<typeof persistUploadImage>;

describe('useCastleCollectibles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedList.mockReturnValue([]);
  });

  it('sets camera-permission-denied when upload permission fails', async () => {
    mockedPick.mockRejectedValue(new Error('camera-permission-denied'));

    const { result } = renderHook(() => useCastleCollectibles(1, 'goshuin'));

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
      id: '1:goshuin:upload.jpg',
      castleId: 1,
      kind: 'goshuin' as const,
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
      .mockReturnValueOnce([savedItem]); // final refresh

    const { result } = renderHook(() => useCastleCollectibles(1, 'goshuin'));

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

    const { result } = renderHook(() => useCastleCollectibles(1, 'goshuin'));

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

  it('does not show an error when the native picker is cancelled', async () => {
    mockedPick.mockRejectedValue(new Error('User canceled image selection'));

    const { result } = renderHook(() => useCastleCollectibles(1, 'visit-record'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.uploadFromSource('camera');
    });

    expect(result.current.error).toBeNull();
    expect(mockedSave).not.toHaveBeenCalled();
    expect(result.current.uploading).toBe(false);
  });
});
