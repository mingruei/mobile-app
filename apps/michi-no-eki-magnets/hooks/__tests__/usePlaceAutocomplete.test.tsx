import { act, renderHook, waitFor } from '@testing-library/react-native';

import { usePlaceAutocomplete } from '../usePlaceAutocomplete';
import {
  createPlaceSessionToken,
  fetchPlaceSuggestions,
  fetchSelectedPlace,
} from '../../utils/googlePlaces';
import { isGooglePlacesConfigured } from '../../utils/googlePlacesConfig';

jest.mock('../../utils/googlePlacesConfig', () => ({
  isGooglePlacesConfigured: jest.fn(() => true),
}));

jest.mock('../../utils/googlePlaces', () => ({
  createPlaceSessionToken: jest.fn(() => 'session-token'),
  fetchPlaceSuggestions: jest.fn(),
  fetchSelectedPlace: jest.fn(),
}));

const mockedIsConfigured = isGooglePlacesConfigured as jest.MockedFunction<
  typeof isGooglePlacesConfigured
>;
const mockedCreateToken = createPlaceSessionToken as jest.MockedFunction<
  typeof createPlaceSessionToken
>;
const mockedFetchSuggestions = fetchPlaceSuggestions as jest.MockedFunction<
  typeof fetchPlaceSuggestions
>;
const mockedFetchSelected = fetchSelectedPlace as jest.MockedFunction<typeof fetchSelectedPlace>;

describe('usePlaceAutocomplete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockedIsConfigured.mockReturnValue(true);
    mockedCreateToken.mockReturnValue('session-token');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stays idle when Places is not configured', () => {
    mockedIsConfigured.mockReturnValue(false);

    const { result } = renderHook(() => usePlaceAutocomplete());

    act(() => {
      result.current.setQuery('東京');
    });

    expect(result.current.isConfigured).toBe(false);
    expect(result.current.status).toBe('idle');
    expect(mockedFetchSuggestions).not.toHaveBeenCalled();
  });

  it('debounces and loads suggestions for a query', async () => {
    mockedFetchSuggestions.mockResolvedValue([
      {
        placeId: 'place-1',
        primaryText: '東京駅',
        secondaryText: '日本',
        fullText: '東京駅, 日本',
      },
    ]);

    const { result } = renderHook(() => usePlaceAutocomplete());

    act(() => {
      result.current.beginSession();
      result.current.setQuery('東京');
    });

    expect(result.current.status).toBe('loading');

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    expect(mockedFetchSuggestions).toHaveBeenCalledWith('東京', 'session-token');
    expect(result.current.suggestions).toHaveLength(1);
  });

  it('surfaces autocomplete errors', async () => {
    mockedFetchSuggestions.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => usePlaceAutocomplete());

    act(() => {
      result.current.setQuery('大阪');
    });

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    expect(result.current.errorMessage).toBe('network down');
    expect(result.current.suggestions).toEqual([]);
  });

  it('selects a suggestion and clears the session token', async () => {
    mockedFetchSelected.mockResolvedValue({
      placeId: 'place-1',
      label: '東京駅',
      latitude: 35.6812,
      longitude: 139.7671,
    });
    mockedFetchSuggestions.mockResolvedValue([]);

    const { result } = renderHook(() => usePlaceAutocomplete());

    act(() => {
      result.current.beginSession();
    });

    await act(async () => {
      await result.current.selectSuggestion({
        placeId: 'place-1',
        primaryText: '東京駅',
        secondaryText: '日本',
        fullText: '東京駅, 日本',
      });
    });

    expect(mockedFetchSelected).toHaveBeenCalledWith('place-1', 'session-token');
    expect(result.current.query).toBe('東京駅');
    expect(result.current.suggestions).toEqual([]);

    // Selecting sets the query label, which retriggers autocomplete; settle it.
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
  });

  it('clears session state', () => {
    const { result } = renderHook(() => usePlaceAutocomplete());

    act(() => {
      result.current.beginSession();
      result.current.setQuery('京都');
    });

    act(() => {
      result.current.clearSession();
    });

    expect(result.current.suggestions).toEqual([]);
    expect(result.current.status).toBe('idle');
    expect(result.current.errorMessage).toBeNull();
  });
});
