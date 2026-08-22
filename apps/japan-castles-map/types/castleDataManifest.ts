export type CastleDataFileRef = {
  path: string;
  size?: number;
  locale?: string;
};

export type CastleDataManifest = {
  version: number;
  updatedAt: string;
  files: {
    castles: CastleDataFileRef;
    content: CastleDataFileRef;
  };
};

export type CastleDataBundle = {
  version: number;
  updatedAt: string;
  castles: readonly import('./castle').Castle[];
  contentByLocale: Record<string, Record<string, unknown>>;
};
