import type { StationServiceId } from '../constants/stationServices';

export type Station = {
  id: number;
  number: number;
  name: string;
  nameEn?: string | null;
  prefecture: string;
  city: string;
  location: string;
  latitude: number;
  longitude: number;
  shortDescription?: string | null;
  website?: string | null;
  access?: string | null;
  services: StationServiceId[];
};

export type ProgressFilter =
  | 'all'
  | 'visited'
  | 'not-visited'
  | 'has-magnet'
  | 'no-magnet';
