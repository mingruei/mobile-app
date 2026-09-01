export type CastleDataFileRef = {
  path: string;
  size?: number;
  locale?: string;
};

export type CastleDataManifest = {
  version: number;
  updatedAt: string;
  releaseNotes?: string[];
  files: {
    castles: CastleDataFileRef;
    content: CastleDataFileRef;
  };
};

export type CastleDataBundle = {
  version: number;
  updatedAt: string;
  releaseNotes: string[];
  castles: readonly import('./castle').Castle[];
  contentByLocale: Record<string, Record<string, unknown>>;
};

export function normalizeReleaseNotes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0,
  );
}
