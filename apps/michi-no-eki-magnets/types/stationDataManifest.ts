export type StationDataFileRef = {
  path: string;
  size?: number;
  locale?: string;
};

export type StationDataManifest = {
  version: number;
  updatedAt: string;
  files: {
    stations: StationDataFileRef;
  };
};

export type StationDataBundle = {
  version: number;
  updatedAt: string;
  stations: readonly import('./station').Station[];
};
