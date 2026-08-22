import { useCallback, useEffect, useRef, useState } from 'react';

import {
  COLLECTIBLE_PROGRESS_FIELD,
  isSingleFileCollectibleKind,
  type CastleCollectible,
  type CollectibleKind,
} from '../types/castleCollectible';
import { isPickerCancelledErrorMessage } from '../utils/collectibleUploadErrors';
import {
  deleteCastleCollectible,
  listCastleCollectibles,
  saveCastleCollectibleFromUri,
} from '../utils/castleCollectibleStorage';
import { persistUploadImage } from '../utils/persistUploadImage';
import {
  pickCollectibleBySource,
  type CollectibleUploadSource,
} from '../utils/castleCollectibleUpload';
import { useCastleProgress } from './useCastleProgress';

type UseCastleCollectiblesResult = {
  items: CastleCollectible[];
  loading: boolean;
  uploading: boolean;
  error: string | null;
  refresh: () => void;
  uploadFromSource: (source: CollectibleUploadSource) => Promise<void>;
  removeItem: (item: CastleCollectible) => void;
};

export function useCastleCollectibles(
  castleId: number,
  kind: CollectibleKind,
): UseCastleCollectiblesResult {
  const { getProgress, markProgressCollected } = useCastleProgress();
  const [items, setItems] = useState<CastleCollectible[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const progressField = COLLECTIBLE_PROGRESS_FIELD[kind];
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    try {
      const nextItems = listCastleCollectibles(castleId, kind);
      if (!mountedRef.current) {
        return;
      }
      setItems(nextItems);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) {
        return;
      }
      setError('collectible-load-failed');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [castleId, kind]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (items.length === 0) {
      return;
    }

    const progress = getProgress(castleId);
    if (!progress[progressField]) {
      markProgressCollected(castleId, progressField);
    }
  }, [castleId, getProgress, items.length, markProgressCollected, progressField]);

  const uploadFromSource = useCallback(
    async (source: CollectibleUploadSource) => {
      setError(null);

      try {
        const selections = await pickCollectibleBySource(source);
        if (selections.length === 0) {
          return;
        }

        setUploading(true);
        const toSave = isSingleFileCollectibleKind(kind)
          ? selections.slice(0, 1)
          : selections;

        for (const selection of toSave) {
          if (!mountedRef.current) {
            return;
          }
          const persistedUri = await persistUploadImage(
            selection.uri,
            selection.mimeType ?? 'image/jpeg',
            { base64Data: selection.base64 },
          );
          await saveCastleCollectibleFromUri(
            castleId,
            kind,
            persistedUri,
            selection.mimeType,
            { base64Data: selection.base64 },
          );
        }

        if (!mountedRef.current) {
          return;
        }

        markProgressCollected(castleId, progressField);
        refresh();
      } catch (err) {
        if (!mountedRef.current) {
          return;
        }
        if (err instanceof Error && isPickerCancelledErrorMessage(err.message)) {
          return;
        }
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('collectible-upload-failed');
        }
      } finally {
        if (mountedRef.current) {
          setUploading(false);
        }
      }
    },
    [castleId, kind, markProgressCollected, progressField, refresh],
  );

  const removeItem = useCallback(
    (item: CastleCollectible) => {
      deleteCastleCollectible(item);
      refresh();
    },
    [refresh],
  );

  return {
    items,
    loading,
    uploading,
    error,
    refresh,
    uploadFromSource,
    removeItem,
  };
}
