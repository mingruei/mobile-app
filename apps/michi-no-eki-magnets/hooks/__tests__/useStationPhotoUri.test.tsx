import { renderHook, waitFor } from '@testing-library/react-native';

import type { Station } from '../../types/station';
import {
  getCachedStationPhotoUri,
  resolveStationPhotoUri,
} from '../../utils/stationPhotoCache';
import { useStationPhotoUri } from '../useStationPhotoUri';

jest.mock('../../utils/stationPhotoCache', () => ({
  getCachedStationPhotoUri: jest.fn(),
  resolveStationPhotoUri: jest.fn(),
}));

const mockedGetCached = getCachedStationPhotoUri as jest.MockedFunction<
  typeof getCachedStationPhotoUri
>;
const mockedResolve = resolveStationPhotoUri as jest.MockedFunction<typeof resolveStationPhotoUri>;

function station(overrides: Partial<Station> = {}): Station {
  return {
    id: 1,
    number: 1,
    name: '道の駅テスト',
    prefecture: '北海道',
    city: 'テスト市',
    location: '',
    latitude: 43,
    longitude: 141,
    services: [],
    imageUrl: 'https://example.com/photo.jpg',
    ...overrides,
  };
}

describe('useStationPhotoUri', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves immediately when the station has no image', () => {
    const { result } = renderHook(() => useStationPhotoUri(station({ imageUrl: undefined }), 4));

    expect(result.current).toEqual({ uri: null, resolved: true });
    expect(mockedResolve).not.toHaveBeenCalled();
  });

  it('uses a cached uri when available', async () => {
    mockedGetCached.mockReturnValue('file:///cache/1.jpg');
    mockedResolve.mockResolvedValue('file:///cache/1.jpg');

    const { result } = renderHook(() => useStationPhotoUri(station(), 4));

    expect(result.current).toEqual({ uri: 'file:///cache/1.jpg', resolved: true });

    await waitFor(() => {
      expect(mockedResolve).toHaveBeenCalledWith({
        stationId: 1,
        imageUrl: 'https://example.com/photo.jpg',
        dataVersion: 4,
      });
    });
  });

  it('loads a remote photo when cache misses', async () => {
    mockedGetCached.mockReturnValue(null);
    mockedResolve.mockResolvedValue('file:///downloaded/1.jpg');

    const { result } = renderHook(() => useStationPhotoUri(station(), 4));

    expect(result.current).toEqual({ uri: null, resolved: false });

    await waitFor(() => {
      expect(result.current).toEqual({ uri: 'file:///downloaded/1.jpg', resolved: true });
    });
  });
});
