import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { setCastleContentForLocale, type CastleContentOverlay } from '../i18n/castleContent';
import type { Castle } from '../types/castle';
import type { CastleDataBundle } from '../types/castleDataManifest';
import { isCastleDataRemoteSyncConfigured } from '../utils/castleDataConfig';
import {
  BUNDLED_CASTLE_DATA_VERSION,
  getBundledCastleDataBundle,
  loadInitialCastleDataBundle,
  syncRemoteCastleDataBundle,
  type CastleDataSource,
} from '../utils/castleDataSync';

type CastleDataContextValue = {
  castles: readonly Castle[];
  revision: number;
  version: number;
  updatedAt: string;
  releaseNotes: string[];
  source: CastleDataSource;
  bundledVersion: number;
  remoteSyncConfigured: boolean;
  ready: boolean;
  showUpdateNotice: boolean;
  dismissUpdateNotice: () => void;
};

const CastleDataContext = createContext<CastleDataContextValue | null>(null);

function applyCastleDataBundle(bundle: CastleDataBundle) {
  for (const [locale, content] of Object.entries(bundle.contentByLocale)) {
    setCastleContentForLocale(
      locale as 'zh-Hant',
      content as Record<string, CastleContentOverlay>,
    );
  }
}

export function CastleDataProvider({ children }: { children: ReactNode }) {
  const bundled = useMemo(() => getBundledCastleDataBundle(), []);
  const [castles, setCastles] = useState<readonly Castle[]>(bundled.castles);
  const [version, setVersion] = useState(bundled.version);
  const [updatedAt, setUpdatedAt] = useState(bundled.updatedAt);
  const [releaseNotes, setReleaseNotes] = useState(bundled.releaseNotes);
  const [source, setSource] = useState<CastleDataSource>('bundled');
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const [showUpdateNotice, setShowUpdateNotice] = useState(false);
  const remoteSyncConfigured = isCastleDataRemoteSyncConfigured();

  const dismissUpdateNotice = useCallback(() => {
    setShowUpdateNotice(false);
  }, []);

  useEffect(() => {
    applyCastleDataBundle(bundled);
  }, [bundled]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const initial = await loadInitialCastleDataBundle();
      if (cancelled) {
        return;
      }

      applyCastleDataBundle(initial);
      setCastles(initial.castles);
      setVersion(initial.version);
      setUpdatedAt(initial.updatedAt);
      setReleaseNotes(initial.releaseNotes);
      setSource(initial.source);
      setRevision((current) => current + 1);
      setReady(true);

      const synced = await syncRemoteCastleDataBundle(initial.version);
      if (cancelled || !synced || synced.version <= initial.version) {
        return;
      }

      applyCastleDataBundle(synced);
      setCastles(synced.castles);
      setVersion(synced.version);
      setUpdatedAt(synced.updatedAt);
      setReleaseNotes(synced.releaseNotes);
      setSource('remote');
      setRevision((current) => current + 1);
      setShowUpdateNotice(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      castles,
      revision,
      version,
      updatedAt,
      releaseNotes,
      source,
      bundledVersion: BUNDLED_CASTLE_DATA_VERSION,
      remoteSyncConfigured,
      ready,
      showUpdateNotice,
      dismissUpdateNotice,
    }),
    [
      castles,
      dismissUpdateNotice,
      ready,
      releaseNotes,
      remoteSyncConfigured,
      revision,
      showUpdateNotice,
      source,
      updatedAt,
      version,
    ],
  );

  return <CastleDataContext.Provider value={value}>{children}</CastleDataContext.Provider>;
}

export function useCastleData(): CastleDataContextValue {
  const context = useContext(CastleDataContext);
  if (!context) {
    throw new Error('useCastleData must be used within CastleDataProvider');
  }

  return context;
}

export function useCastles(): readonly Castle[] {
  return useCastleData().castles;
}
