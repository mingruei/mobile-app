import { ErrorCode, useIAP, type PurchaseError } from 'expo-iap';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { TIP_PRODUCT_IDS, TIP_SMALL_PRODUCT_ID } from '../constants/tipProducts';

export type TipJarStatus = 'idle' | 'purchasing' | 'thanks' | 'error';

function isUserCancelledError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = (error as PurchaseError).code;
  return code === ErrorCode.UserCancelled;
}

export function useTipJar() {
  const [status, setStatus] = useState<TipJarStatus>('idle');

  const { connected, products, fetchProducts, requestPurchase, finishTransaction } = useIAP({
    onPurchaseSuccess: async (purchase) => {
      try {
        await finishTransaction({ purchase, isConsumable: true });
        setStatus('thanks');
      } catch {
        setStatus('error');
      }
    },
    onPurchaseError: (error) => {
      if (isUserCancelledError(error)) {
        setStatus('idle');
        return;
      }

      setStatus('error');
    },
  });

  useEffect(() => {
    if (connected) {
      void fetchProducts({ skus: [...TIP_PRODUCT_IDS], type: 'in-app' });
    }
  }, [connected, fetchProducts]);

  const tipProduct = useMemo(
    () => products.find((product) => product.id === TIP_SMALL_PRODUCT_ID) ?? null,
    [products],
  );

  const purchaseTip = useCallback(async () => {
    setStatus('purchasing');

    try {
      await requestPurchase({
        type: 'in-app',
        request: {
          apple: { sku: TIP_SMALL_PRODUCT_ID },
          google: { skus: [TIP_SMALL_PRODUCT_ID] },
        },
      });
    } catch (error) {
      if (isUserCancelledError(error)) {
        setStatus('idle');
        return;
      }

      setStatus('error');
    }
  }, [requestPurchase]);

  const resetStatus = useCallback(() => {
    setStatus('idle');
  }, []);

  return {
    connected,
    tipProduct,
    purchaseTip,
    status,
    resetStatus,
    isPurchasing: status === 'purchasing',
  };
}
