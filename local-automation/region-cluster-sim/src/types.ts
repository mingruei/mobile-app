export type SimPlace = {
  placeIndex: number;
  label: string;
  latitude: number;
  longitude: number;
  hasCoords: boolean;
};

export type ClusterParams = {
  mergeKm: number;
  farKm: number;
  outlierKm: number;
};

export type CapacityParams = {
  maxStopsPerDay: number;
  maxRegionSpanKmPerDay: number;
  defaultDwellMinutes: number;
};

export type LatLng = { latitude: number; longitude: number };

export type CorridorAnchor = LatLng & { label: string };

export type CorridorAnchors = {
  start: CorridorAnchor;
  end: CorridorAnchor;
};

export type Region = {
  regionId: string;
  placeIndexes: number[];
  centroid: LatLng;
  spanKm: number;
};

export type Outlier = {
  placeIndex: number;
  nearestRegionId: string | null;
  distanceKm: number;
  reason?: 'cluster' | 'corridor' | 'lodging' | 'capacity';
};

export type LodgingNight = {
  dayIndex: number;
  lodging: CorridorAnchor;
};

export type LodgingSchedule = {
  nights: LodgingNight[];
  tripStart: CorridorAnchor | null;
  tripEnd: CorridorAnchor | null;
};

export type ClusterResult = {
  regions: Region[];
  outliers: Outlier[];
  unlocated: number[];
  params: ClusterParams;
};

export type DayStopDraft = {
  placeIndex: number;
  regionId: string;
  dwellMinutes: number;
  notes: string;
};

export type DayDraft = {
  dayIndex: number;
  regionIds: string[];
  stops: DayStopDraft[];
  summary: string;
};

export type CapacityResult = {
  days: DayDraft[];
  suggestedDayCount: number;
  existingDayCount: number;
  fitsTripDays: boolean;
  extraDaysNeeded: number;
  pendingUserDecision: Outlier[];
  params: CapacityParams;
};

export type AiRegionEnrich = {
  regionId: string;
  name: string;
  placeOrder?: number[];
};

export type AiDayEnrich = {
  dayIndex: number;
  summary: string;
  stops?: Array<{ placeIndex: number; dwellMinutes: number; notes: string }>;
};

export type AiOutlierNote = {
  placeIndex: number;
  advice: string;
};

export type AiEnrichment = {
  regions: AiRegionEnrich[];
  days: AiDayEnrich[];
  outliers: AiOutlierNote[];
};

export type DayRouteLeg = {
  fromLabel: string;
  toLabel: string;
  durationSeconds: number;
  distanceMeters: number;
  error?: string;
};

export type DayRoutePlan = {
  dayIndex: number;
  legs: DayRouteLeg[];
  totalDriveSeconds: number;
  totalDistanceMeters: number;
  totalDwellMinutes: number;
  dayLoadMinutes: number;
  overBudget: boolean;
};

export type MustVisitMatch = {
  pattern: string;
  placeIndex: number;
  label: string;
};

export type SimReport = {
  places: SimPlace[];
  cluster: ClusterResult;
  capacity: CapacityResult;
  corridor: CorridorAnchors | null;
  corridorMaxKm: number | null;
  lodging: LodgingSchedule | null;
  mustVisitPatterns: string[];
  mustVisitMatched: MustVisitMatch[];
  mustVisitUnmatched: string[];
  dayRoutes: DayRoutePlan[] | null;
  dayBudgetMinutes: number | null;
  ai: AiEnrichment | null;
  regionNames: Record<string, string>;
  generatedAt: string;
};
