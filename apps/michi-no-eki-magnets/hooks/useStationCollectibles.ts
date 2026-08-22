import { useCallback, useEffect, useRef, useState } from 'react';

import {
  COLLECTIBLE_PROGRESS_FIELD,
  type StationCollectible,
  type CollectibleKind,
} from '../types/stationCollectible';
import {
  deleteStationCollectible,
  listStationCollectibles,
  saveStationCollectibleFromUri,
} from '../utils/stationCollectibleStorage';
import { persistUploadImage } from '../utils/persistUploadImage';
import {
  pickCollectibleBySource,
  type CollectibleUploadSource,
} from '../utils/stationCollectibleUpload';
import { useStationProgress } from './useStationProgress';

type UseStationCollectiblesResult = {
  items: StationCollectible[];
  loading: boolean;
  uploading: boolean;
  error: string | null;
  refresh: () => void;
  uploadFromSource: (source: CollectibleUploadSource) => Promise<void>;
  removeItem: (item: StationCollectible) => void;
};

export function useStationCollectibles(
  stationId: number,
  kind: CollectibleKind,
): UseStationCollectiblesResult {
  const { getProgress, markProgressCollected } = useStationProgress();
  const [items, setItems] = useState<StationCollectible[]>([]);
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
      const nextItems = listStationCollectibles(stationId, kind);
      if (!mountedRef.current) {
        return;
      }
      setItems(nextItems);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) {
        return;
      }
      setError(err instanceof Error ? err.message : 'collectible-load-failed');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [stationId, kind]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (items.length === 0) {
      return;
    }

    const progress = getProgress(stationId);
    if (!progress[progressField]) {
      markProgressCollected(stationId, progressField);
    }
  }, [stationId, getProgress, items.length, markProgressCollected, progressField]);

  const uploadFromSource = useCallback(
    async (source: CollectibleUploadSource) => {
      setError(null);

      try {
        const selections = await pickCollectibleBySource(source);
        if (selections.length === 0) {
          return;
        }

        setUploading(true);
        const existingCount = listStationCollectibles(stationId, kind).length;

        for (const selection of selections) {
          if (!mountedRef.current) {
            return;
          }
          const persistedUri = await persistUploadImage(
            selection.uri,
            selection.mimeType ?? 'image/jpeg',
            { base64Data: selection.base64 },
          );
          await saveStationCollectibleFromUri(
            stationId,
            kind,
            persistedUri,
            selection.mimeType,
            { base64Data: selection.base64 },
          );
        }

        const savedItems = listStationCollectibles(stationId, kind);
        const uploadSucceeded = savedItems.length > existingCount;
        if (!uploadSucceeded) {
          throw new Error('collectible-upload-failed');
        }

        if (!mountedRef.current) {
          return;
        }

        markProgressCollected(stationId, progressField);
        refresh();
      } catch (err) {
        if (!mountedRef.current) {
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
    [stationId, kind, markProgressCollected, progressField, refresh],
  );

  const removeItem = useCallback(
    (item: StationCollectible) => {
      deleteStationCollectible(item);
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
