export const CURRENT_LOCATION_PLACE_ID = 'current-location';

export type SelectedPlace = {
  placeId: string;
  label: string;
  formattedAddress?: string | null;
  latitude: number;
  longitude: number;
};

export function isCurrentLocationPlace(place: SelectedPlace | null | undefined): boolean {
  return place?.placeId === CURRENT_LOCATION_PLACE_ID;
}

export function createCurrentLocationPlace(
  latitude: number,
  longitude: number,
  label: string,
): SelectedPlace {
  return {
    placeId: CURRENT_LOCATION_PLACE_ID,
    label,
    latitude,
    longitude,
  };
}
