import type {
  CastleDrivingContent,
  CastlePublicTransitContent,
  NavigationPoint,
} from './navigation';

export type CastleContentFields = {
  locationLabel: string;
  displayName: string;
  alias?: string | null;
  description: string;
  subtitle?: string | null;
    stampLocations: NavigationPoint[];
    castleCardLocations: NavigationPoint[];
    driving: CastleDrivingContent;
  publicTransit: CastlePublicTransitContent;
};
