import { act, renderHook } from '@testing-library/react-native';

import { useGlobalCollectibleUpload } from '../useGlobalCollectibleUpload';
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
}));

jest.mock('../../utils/persistUploadImage', () => ({
  persistUploadImage: jest.fn(async (uri: string) => uri),
}));

jest.mock('../../utils/waitForNativePicker', () => ({
  waitForNativePicker: jest.fn(async () => undefined),
}));

jest.mock('../useCastleProgress', () => ({
  useCastleProgress: () => ({
    markProgressCollected: jest.fn(),
  }),
}));

const mockedPick = pickCollectibleBySource as jest.MockedFunction<typeof pickCollectibleBySource>;
const mockedList = listCastleCollectibles as jest.MockedFunction<typeof listCastleCollectibles>;
const mockedSave = saveCastleCollectibleFromUri as jest.MockedFunction<typeof saveCastleCollectibleFromUri>;

describe('useGlobalCollectibleUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockedList.mockReturnValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('opens and closes the source picker flow', () => {
    const { result } = renderHook(() => useGlobalCollectibleUpload());

    act(() => {
      result.current.openSourcePicker();
    });
    expect(result.current.phase).toBe('source-picker');

    act(() => {
      result.current.closeFlow();
    });
    expect(result.current.phase).toBe('idle');
    expect(result.current.draft).toBeNull();
  });

  it('rejects pdf uploads with a dedicated error', async () => {
    mockedPick.mockResolvedValue([
      {
        uri: 'file:///tmp/card.pdf',
        mimeType: 'application/pdf',
      },
    ]);

    const { result } = renderHook(() => useGlobalCollectibleUpload());

    act(() => {
      result.current.openSourcePicker();
    });

    await act(async () => {
      await result.current.selectSource('file');
    });

    expect(result.current.error).toBe('global-upload-pdf-not-supported');
    expect(result.current.phase).toBe('source-picker');
    expect(result.current.draft).toBeNull();
  });

  it('creates a confirm draft for image selections', async () => {
    mockedPick.mockResolvedValue([
      {
        uri: 'file:///tmp/stamp.jpg',
        mimeType: 'image/jpeg',
        width: 1000,
        height: 1000,
        base64: null,
      },
    ]);

    const { result } = renderHook(() => useGlobalCollectibleUpload());

    await act(async () => {
      await result.current.selectSource('gallery');
    });

    expect(result.current.phase).toBe('confirm');
    expect(result.current.draft?.typeSuggestion.kind).toBe('meijo-stamp');
    expect(result.current.error).toBeNull();
  });

  it('maps permission failures back to the source picker', async () => {
    mockedPick.mockRejectedValue(new Error('camera-permission-denied'));

    const { result } = renderHook(() => useGlobalCollectibleUpload());

    await act(async () => {
      await result.current.selectSource('scan');
    });

    expect(result.current.error).toBe('camera-permission-denied');
    expect(result.current.phase).toBe('source-picker');
  });

  it('confirms upload and dismisses the flow on success', async () => {
    mockedPick.mockResolvedValue([
      {
        uri: 'file:///tmp/card.jpg',
        mimeType: 'image/jpeg',
        width: 1600,
        height: 900,
        base64: null,
      },
    ]);
    mockedList.mockReturnValueOnce([]).mockReturnValueOnce([
      {
        id: '3:castle-card:card.jpg',
        castleId: 3,
        kind: 'castle-card',
        uri: 'file:///saved/card.jpg',
        filename: 'card.jpg',
        mimeType: 'image/jpeg',
        createdAt: 1,
      },
    ]);

    const { result } = renderHook(() => useGlobalCollectibleUpload());

    await act(async () => {
      await result.current.selectSource('gallery');
    });

    await act(async () => {
      await result.current.confirmUpload(3, 'castle-card');
    });

    expect(mockedSave).toHaveBeenCalled();
    expect(result.current.phase).toBe('idle');

    act(() => {
      jest.advanceTimersByTime(350);
    });
    expect(result.current.draft).toBeNull();
  });
});
