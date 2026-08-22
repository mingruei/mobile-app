export type NavigationPoint = {
  /** Display label in the app (often Traditional Chinese). */
  label: string;
  /** Japanese place name for Google Maps. Falls back to label, then coordinates. */
  googleLabel?: string;
  /** Opening hours for stamp locations (Traditional Chinese). */
  businessHours?: string;
  latitude?: number | null;
  longitude?: number | null;
};

export type CastleDrivingContent = {
  description?: string | null;
  parkingLocations: NavigationPoint[];
};

export type CastlePublicTransitContent = {
  description: string;
  destinationLatitude: number;
  destinationLongitude: number;
  /** Japanese POI name sent to Google Maps. */
  destinationLabel: string;
};
