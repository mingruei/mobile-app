export const STATION_SERVICE_IDS = [
  'atm',
  'babyBed',
  'restaurant',
  'cafe',
  'lodging',
  'hotSpring',
  'camping',
  'park',
  'observatory',
  'museum',
  'gasStation',
  'evCharging',
  'wifi',
  'shower',
  'experience',
  'touristInfo',
  'accessibleRestroom',
  'shop',
  'minatoOasis',
] as const;

export type StationServiceId = (typeof STATION_SERVICE_IDS)[number];

export function isStationServiceId(value: string): value is StationServiceId {
  return (STATION_SERVICE_IDS as readonly string[]).includes(value);
}

export function stationHasServices(
  services: readonly StationServiceId[],
  required: readonly StationServiceId[],
): boolean {
  if (required.length === 0) {
    return true;
  }

  const available = new Set(services);
  return required.every((service) => available.has(service));
}
