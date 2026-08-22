export const COLLECTIBLE_KINDS = ['magnet'] as const;

export type CollectibleKind = (typeof COLLECTIBLE_KINDS)[number];

export const MEDIA_COLLECTIBLE_KINDS = ['magnet'] as const;

export type MediaCollectibleKind = (typeof MEDIA_COLLECTIBLE_KINDS)[number];

export type StationCollectible = {
  id: string;
  stationId: number;
  kind: CollectibleKind;
  uri: string;
  filename: string;
  mimeType: string | null;
  createdAt: number;
};

export const COLLECTIBLE_PROGRESS_FIELD: Record<CollectibleKind, 'magnet'> = {
  magnet: 'magnet',
};

export function isCollectibleKind(value: string): value is CollectibleKind {
  return (COLLECTIBLE_KINDS as readonly string[]).includes(value);
}
