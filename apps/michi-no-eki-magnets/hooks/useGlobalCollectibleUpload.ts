import { useCallback, useState } from 'react';

import {
  COLLECTIBLE_PROGRESS_FIELD,
  type CollectibleKind,
} from '../types/stationCollectible';
import { saveStationCollectibleFromUri, listStationCollectibles } from '../utils/stationCollectibleStorage';
import {
  detectCollectibleKind,
  type CollectibleTypeSuggestion,
} from '../utils/collectibleTypeDetection';
import {
  pickCollectibleBySource,
  type CollectibleUploadSelection,
  type CollectibleUploadSource,
} from '../utils/stationCollectibleUpload';
import { resolveSelectionDimensions } from '../utils/getImageDimensions';
import { persistUploadImage } from '../utils/persistUploadImage';
import { waitForNativePicker } from '../utils/waitForNativePicker';
import { useStationProgress } from './useStationProgress';

export type GlobalUploadPhase =
  | 'idle'
  | 'source-picker'
  | 'picking'
  | 'confirm'
  | 'saving';

export type GlobalUploadDraft = {
  selection: CollectibleUploadSelection;
  dimensions: { width: number; height: number };
  typeSuggestion: CollectibleTypeSuggestion;
};

type UseGlobalCollectibleUploadResult = {
  phase: GlobalUploadPhase;
  draft: GlobalUploadDraft | null;
  error: string | null;
  openSourcePicker: () => void;
  closeFlow: () => void;
  selectSource: (source: CollectibleUploadSource) => Promise<void>;
  confirmUpload: (stationId: number, kind: CollectibleKind) => Promise<void>;
};

export function useGlobalCollectibleUpload(): UseGlobalCollectibleUploadResult {
  const { markProgressCollected } = useStationProgress();
  const [phase, setPhase] = useState<GlobalUploadPhase>('idle');
  const [draft, setDraft] = useState<GlobalUploadDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPhase('idle');
    setError(null);
  }, []);

  const clearDraft = useCallback(() => {
    setDraft(null);
  }, []);

  const openSourcePicker = useCallback(() => {
    setError(null);
    clearDraft();
    setPhase('source-picker');
  }, [clearDraft]);

  const closeFlow = useCallback(() => {
    reset();
    clearDraft();
  }, [clearDraft, reset]);

  const dismissConfirmFlow = useCallback(() => {
    reset();
    setTimeout(() => {
      clearDraft();
    }, 350);
  }, [clearDraft, reset]);

  const selectSource = useCallback(async (source: CollectibleUploadSource) => {
    setError(null);
    setPhase('idle');

    try {
      await waitForNativePicker();
      const selections = await pickCollectibleBySource(source);
      if (selections.length === 0) {
        setPhase('source-picker');
        return;
      }

      const selection = selections[0];
      const mimeType = selection.mimeType ?? '';
      if (mimeType === 'application/pdf' || selection.uri.toLowerCase().endsWith('.pdf')) {
        setError('global-upload-pdf-not-supported');
        setPhase('source-picker');
        return;
      }

      setPhase('picking');
      const persistedUri = await persistUploadImage(
        selection.uri,
        selection.mimeType ?? 'image/jpeg',
        { base64Data: selection.base64 },
      );
      const persistedSelection: CollectibleUploadSelection = {
        ...selection,
        uri: persistedUri,
      };

      const dimensions = await resolveSelectionDimensions(persistedSelection);
      const typeSuggestion = detectCollectibleKind(dimensions);

      setDraft({
        selection: persistedSelection,
        dimensions,
        typeSuggestion,
      });
      setPhase('confirm');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('global-upload-failed');
      }
      setPhase('source-picker');
    }
  }, []);

  const confirmUpload = useCallback(
    async (stationId: number, kind: CollectibleKind) => {
      if (!draft) {
        return;
      }

      setPhase('saving');
      setError(null);

      try {
        const existingCount = listStationCollectibles(stationId, kind).length;
        await saveStationCollectibleFromUri(
          stationId,
          kind,
          draft.selection.uri,
          draft.selection.mimeType,
          { base64Data: draft.selection.base64 },
        );

        const savedItems = listStationCollectibles(stationId, kind);
        const uploadSucceeded = savedItems.length > existingCount;
        if (!uploadSucceeded) {
          throw new Error('global-upload-failed');
        }

        markProgressCollected(stationId, COLLECTIBLE_PROGRESS_FIELD[kind]);
        dismissConfirmFlow();
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('global-upload-failed');
        }
        setPhase('confirm');
      }
    },
    [draft, dismissConfirmFlow, markProgressCollected],
  );

  return {
    phase,
    draft,
    error,
    openSourcePicker,
    closeFlow,
    selectSource,
    confirmUpload,
  };
}
