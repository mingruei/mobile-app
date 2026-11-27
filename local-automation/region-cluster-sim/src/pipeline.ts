import { readFileSync } from 'node:fs';
import { assignDaysByCapacity } from './capacity.ts';
import { clusterPlaces, DEFAULT_CLUSTER_PARAMS } from './cluster.ts';
import { filterClusterByCorridor, makeCorridor } from './corridor.ts';
import { buildDayRoutes } from './dayRoutes.ts';
import { fetchRouteLeg, type RouteLegResult } from './googleRoutes.ts';
import { haversineKm } from './haversine.ts';
import {
  lodgingScheduleFromFixture,
  resolveAirportPreset,
  type LodgingFixture,
} from './lodgingPresets.ts';
import { assignDaysByLodging } from './lodgingAssign.ts';
import { matchMustVisit } from './mustVisit.ts';
import { enrichWithOpenAi } from './openaiEnrich.ts';
import { parseKmlToSimPlaces } from './parseKml.ts';
import { writeReportFiles } from './report.ts';
import type {
  CapacityParams,
  ClusterParams,
  CorridorAnchor,
  LodgingSchedule,
  SimReport,
} from './types.ts';

/** Offline stand-in when ROUTES_MOCK=1 (no Maps key / quota). ~50 km/h crow-flight. */
async function mockFetchRouteLeg(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
): Promise<RouteLegResult> {
  const km = haversineKm(origin, destination);
  const durationSeconds = Math.round((km / 50) * 3600);
  return {
    durationSeconds,
    distanceMeters: Math.round(km * 1000),
    fetchedAt: new Date().toISOString(),
  };
}

export type PipelineOptions = {
  kmlPath: string;
  days: number;
  outDir: string;
  mergeKm?: number;
  farKm?: number;
  outlierKm?: number;
  maxStopsPerDay?: number;
  maxRegionSpanKmPerDay?: number;
  defaultDwellMinutes?: number;
  startAirport?: string | null;
  endAirport?: string | null;
  corridorMaxKm?: number;
  lodgingPath?: string | null;
  mustPath?: string | null;
  enableRoutes?: boolean;
  avoidTolls?: boolean;
  dayBudgetMinutes?: number;
  noAi?: boolean;
  maxPlaces?: number;
};

function loadMustPatterns(path: string | null | undefined): string[] {
  if (!path) return [];
  const raw = JSON.parse(readFileSync(path, 'utf8')) as
    | string[]
    | { patterns?: string[]; must?: string[] };
  if (Array.isArray(raw)) return raw.map(String);
  return (raw.patterns ?? raw.must ?? []).map(String);
}

function loadLodging(path: string | null | undefined): LodgingSchedule | null {
  if (!path) return null;
  const fixture = JSON.parse(readFileSync(path, 'utf8')) as LodgingFixture;
  return lodgingScheduleFromFixture(fixture);
}

export async function runPipeline(options: PipelineOptions): Promise<{
  report: SimReport;
  jsonPath: string;
  textPath: string;
}> {
  const xml = readFileSync(options.kmlPath, 'utf8');
  const places = parseKmlToSimPlaces(xml, options.maxPlaces ?? 80);

  const clusterParams: Partial<ClusterParams> = {
    mergeKm: options.mergeKm ?? DEFAULT_CLUSTER_PARAMS.mergeKm,
    farKm: options.farKm,
    outlierKm: options.outlierKm,
  };
  let cluster = clusterPlaces(places, clusterParams);

  let corridor = null as ReturnType<typeof makeCorridor> | null;
  let corridorMaxKm: number | null = null;
  if (options.startAirport && options.endAirport) {
    const start = resolveAirportPreset(options.startAirport);
    const end = resolveAirportPreset(options.endAirport);
    corridor = makeCorridor(start, end);
    corridorMaxKm = options.corridorMaxKm ?? 70;
    const filtered = filterClusterByCorridor(places, cluster, corridor, corridorMaxKm);
    cluster = filtered.cluster;
  }

  const lodging = loadLodging(options.lodgingPath);
  if (lodging) {
    if (options.startAirport && !lodging.tripStart) {
      lodging.tripStart = resolveAirportPreset(options.startAirport);
    }
    if (options.endAirport && !lodging.tripEnd) {
      lodging.tripEnd = resolveAirportPreset(options.endAirport);
    }
  }

  const mustPatterns = loadMustPatterns(options.mustPath);
  const must = matchMustVisit(places, mustPatterns);

  // Re-include must-visit places that corridor/cluster parked in pending.
  if (must.placeIndexes.size > 0) {
    cluster = {
      ...cluster,
      outliers: cluster.outliers.filter((o) => !must.placeIndexes.has(o.placeIndex)),
    };
  }

  const capacityParams: Partial<CapacityParams> = {};
  if (options.maxStopsPerDay != null) {
    capacityParams.maxStopsPerDay = options.maxStopsPerDay;
  }
  if (options.maxRegionSpanKmPerDay != null) {
    capacityParams.maxRegionSpanKmPerDay = options.maxRegionSpanKmPerDay;
  }
  if (options.defaultDwellMinutes != null) {
    capacityParams.defaultDwellMinutes = options.defaultDwellMinutes;
  }

  const capacity = lodging
    ? assignDaysByLodging({
        places,
        cluster,
        lodging,
        existingDayCount: options.days,
        params: capacityParams,
        mustVisitIndexes: must.placeIndexes,
      })
    : assignDaysByCapacity(
        places,
        cluster,
        options.days,
        capacityParams,
        corridor,
      );

  const ai = options.noAi
    ? null
    : await enrichWithOpenAi({ places, cluster, capacity });

  const regionNames: Record<string, string> = {};
  for (const region of cluster.regions) {
    regionNames[region.regionId] =
      ai?.regions.find((r) => r.regionId === region.regionId)?.name ?? region.regionId;
  }

  const dayBudgetMinutes = options.dayBudgetMinutes ?? 600;
  let dayRoutes = null as SimReport['dayRoutes'];
  if (options.enableRoutes) {
    if (!lodging) {
      throw new Error('--routes requires --lodging (need day start/end anchors)');
    }
    const useMock = process.env.ROUTES_MOCK === '1';
    dayRoutes = await buildDayRoutes({
      places,
      days: capacity.days,
      lodging,
      dayBudgetMinutes,
      avoidTolls: options.avoidTolls === true,
      fetchLeg: useMock ? mockFetchRouteLeg : fetchRouteLeg,
    });
  }

  const report: SimReport = {
    places,
    cluster,
    capacity,
    corridor,
    corridorMaxKm,
    lodging,
    mustVisitPatterns: mustPatterns,
    mustVisitMatched: must.matched,
    mustVisitUnmatched: must.unmatched,
    dayRoutes,
    dayBudgetMinutes: options.enableRoutes ? dayBudgetMinutes : null,
    ai,
    regionNames,
    generatedAt: new Date().toISOString(),
  };

  const written = writeReportFiles(options.outDir, report);
  return { report, ...written };
}

export type { CorridorAnchor };
