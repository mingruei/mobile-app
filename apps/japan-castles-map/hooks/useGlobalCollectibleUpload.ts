import { useCallback, useState } from 'react';

import {
  COLLECTIBLE_PROGRESS_FIELD,
  type CollectibleKind,
} from '../types/castleCollectible';
import { isPickerCancelledErrorMessage } from '../utils/collectibleUploadErrors';
import { saveCastleCollectibleFromUri } from '../utils/castleCollectibleStorage';
import {
  detectCollectibleKind,
  type CollectibleTypeSuggestion,
} from '../utils/collectibleTypeDetection';
import {
  pickCollectibleBySource,
  type CollectibleUploadSelection,
  type CollectibleUploadSource,
} from '../utils/castleCollectibleUpload';
import { resolveSelectionDimensions } from '../utils/getImageDimensions';
import { persistUploadImage } from '../utils/persistUploadImage';
import { waitForNativePicker } from '../utils/waitForNativePicker';
import { useCastleProgress } from './useCastleProgress';

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
  confirmUpload: (castleId: number, kind: CollectibleKind) => Promise<void>;
};

export function useGlobalCollectibleUpload(): UseGlobalCollectibleUploadResult {
  const { markProgressCollected } = useCastleProgress();
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
      if (err instanceof Error && isPickerCancelledErrorMessage(err.message)) {
        setPhase('source-picker');
        return;
      }
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('global-upload-failed');
      }
      setPhase('source-picker');
    }
  }, []);

  const confirmUpload = useCallback(
    async (castleId: number, kind: CollectibleKind) => {
      if (!draft) {
        return;
      }

      setPhase('saving');
      setError(null);

      try {
        await saveCastleCollectibleFromUri(
          castleId,
          kind,
          draft.selection.uri,
          draft.selection.mimeType,
          { base64Data: draft.selection.base64 },
        );

        markProgressCollected(castleId, COLLECTIBLE_PROGRESS_FIELD[kind]);
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
