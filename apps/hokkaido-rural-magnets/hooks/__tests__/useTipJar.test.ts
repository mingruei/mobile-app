import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ErrorCode, useIAP } from 'expo-iap';

import { TIP_SMALL_PRODUCT_ID } from '../../constants/tipProducts';
import { useTipJar } from '../useTipJar';

type IapCallbacks = {
  onPurchaseSuccess?: (purchase: { productId: string }) => Promise<void>;
  onPurchaseError?: (error: { code?: string }) => void;
};

const mockIapCallbacks: { current: IapCallbacks } = { current: {} };
const mockIapState = {
  connected: false,
  products: [] as { id: string; title: string }[],
  fetchProducts: jest.fn(async () => undefined),
  requestPurchase: jest.fn(async () => undefined),
  finishTransaction: jest.fn(async () => undefined),
};

jest.mock('expo-iap', () => ({
  ErrorCode: { UserCancelled: 'user-cancelled' },
  useIAP: jest.fn((callbacks: IapCallbacks) => {
    mockIapCallbacks.current = callbacks;
    return mockIapState;
  }),
}));

const mockedUseIAP = useIAP as jest.MockedFunction<typeof useIAP>;

describe('useTipJar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIapCallbacks.current = {};
    mockIapState.connected = false;
    mockIapState.products = [];
    mockIapState.fetchProducts = jest.fn(async () => undefined);
    mockIapState.requestPurchase = jest.fn(async () => undefined);
    mockIapState.finishTransaction = jest.fn(async () => undefined);
    mockedUseIAP.mockImplementation((callbacks: IapCallbacks) => {
      mockIapCallbacks.current = callbacks;
      return mockIapState as never;
    });
  });

  it('fetches products when the store connects', async () => {
    mockIapState.connected = true;

    renderHook(() => useTipJar());

    await waitFor(() => {
      expect(mockIapState.fetchProducts).toHaveBeenCalledWith({
        skus: [TIP_SMALL_PRODUCT_ID],
        type: 'in-app',
      });
    });
  });

  it('exposes the configured tip product', () => {
    mockIapState.products = [{ id: TIP_SMALL_PRODUCT_ID, title: '小額支持' }];

    const { result } = renderHook(() => useTipJar());

    expect(result.current.tipProduct).toEqual({
      id: TIP_SMALL_PRODUCT_ID,
      title: '小額支持',
    });
  });

  it('starts purchase and marks purchasing state', async () => {
    const { result } = renderHook(() => useTipJar());

    await act(async () => {
      await result.current.purchaseTip();
    });

    expect(mockIapState.requestPurchase).toHaveBeenCalledWith({
      type: 'in-app',
      request: {
        apple: { sku: TIP_SMALL_PRODUCT_ID },
        google: { skus: [TIP_SMALL_PRODUCT_ID] },
      },
    });
    expect(result.current.isPurchasing).toBe(true);
  });

  it('shows thanks after a successful purchase', async () => {
    const { result } = renderHook(() => useTipJar());

    await act(async () => {
      await mockIapCallbacks.current.onPurchaseSuccess?.({ productId: TIP_SMALL_PRODUCT_ID });
    });

    expect(mockIapState.finishTransaction).toHaveBeenCalledWith({
      purchase: { productId: TIP_SMALL_PRODUCT_ID },
      isConsumable: true,
    });
    expect(result.current.status).toBe('thanks');
  });

  it('returns to idle when the user cancels purchase', async () => {
    mockIapState.requestPurchase.mockRejectedValueOnce({ code: ErrorCode.UserCancelled });

    const { result } = renderHook(() => useTipJar());

    await act(async () => {
      await result.current.purchaseTip();
    });

    expect(result.current.status).toBe('idle');
  });

  it('marks error when purchase fails', async () => {
    mockIapState.requestPurchase.mockRejectedValueOnce(new Error('billing-unavailable'));

    const { result } = renderHook(() => useTipJar());

    await act(async () => {
      await result.current.purchaseTip();
    });

    expect(result.current.status).toBe('error');
  });

  it('handles purchase error callbacks', async () => {
    const { result, rerender } = renderHook(() => useTipJar());

    act(() => {
      mockIapCallbacks.current.onPurchaseError?.({ code: ErrorCode.UserCancelled });
    });
    rerender(undefined);
    expect(result.current.status).toBe('idle');

    act(() => {
      mockIapCallbacks.current.onPurchaseError?.({ code: 'billing-unavailable' });
    });
    rerender(undefined);
    expect(result.current.status).toBe('error');
  });

  it('marks error when finishing the transaction fails', async () => {
    mockIapState.finishTransaction.mockRejectedValueOnce(new Error('finish-failed'));

    const { result } = renderHook(() => useTipJar());

    await act(async () => {
      await mockIapCallbacks.current.onPurchaseSuccess?.({ productId: TIP_SMALL_PRODUCT_ID });
    });

    expect(result.current.status).toBe('error');
  });

  it('resets status back to idle', async () => {
    mockIapState.requestPurchase.mockRejectedValueOnce(new Error('billing-unavailable'));

    const { result } = renderHook(() => useTipJar());

    await act(async () => {
      await result.current.purchaseTip();
    });

    act(() => {
      result.current.resetStatus();
    });

    expect(result.current.status).toBe('idle');
  });
});
