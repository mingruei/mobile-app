export type CastleSeries = 'original' | 'continued';

export type Castle = {
  id: number;
  number: number;
  name: string;
  nameEn?: string | null;
  series: CastleSeries;
  seriesLabel: string;
  prefecture: string;
  city: string;
  location: string;
  latitude: number;
  longitude: number;
  shortDescription?: string | null;
  stampLocation?: string | null;
  /** @deprecated Prefer latitude_stamp in manually edited assets/castles.json */
  stampLatitude?: number | null;
  /** @deprecated Prefer longitude_stamp in manually edited assets/castles.json */
  stampLongitude?: number | null;
  /** @deprecated Prefer latitude_parking in manually edited assets/castles.json */
  parkingLatitude?: number | null;
  /** @deprecated Prefer longitude_parking in manually edited assets/castles.json */
  parkingLongitude?: number | null;
  latitude_stamp?: number | null;
  longitude_stamp?: number | null;
  latitude_parking?: number | null;
  longitude_parking?: number | null;
  massTransport?: string | null;
  website?: string | null;
  history?: string | null;
  access?: string | null;
};

export type SeriesFilter = 'all' | CastleSeries;

export type ProgressFilter =
  | 'all'
  | 'visited'
  | 'not-visited'
  | 'has-meijo-stamp'
  | 'no-meijo-stamp'
  | 'has-goshuin'
  | 'no-goshuin'
  | 'has-castle-card'
  | 'no-castle-card';
