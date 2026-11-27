import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildDayRoutes, buildDayWaypoints } from './dayRoutes.ts';
import type { DayDraft, LodgingSchedule, SimPlace } from './types.ts';
import type { RouteLegResult } from './googleRoutes.ts';

const places: SimPlace[] = [
  {
    placeIndex: 0,
    label: '府内城跡',
    latitude: 33.2407,
    longitude: 131.6115,
    hasCoords: true,
  },
  {
    placeIndex: 1,
    label: '別府地獄めぐり',
    latitude: 33.2831,
    longitude: 131.4705,
    hasCoords: true,
  },
];

const lodging: LodgingSchedule = {
  tripStart: {
    label: '大分機場',
    latitude: 33.4794,
    longitude: 131.7372,
  },
  tripEnd: {
    label: '佐賀機場',
    latitude: 33.1497,
    longitude: 130.3022,
  },
  nights: [
    {
      dayIndex: 1,
      lodging: {
        label: '別府温泉',
        latitude: 33.3165,
        longitude: 131.4842,
      },
    },
    {
      dayIndex: 2,
      lodging: {
        label: '由布院',
        latitude: 33.2627,
        longitude: 131.3551,
      },
    },
  ],
};

describe('buildDayWaypoints', () => {
  it('starts day 1 at tripStart and ends at lodging', () => {
    const day: DayDraft = {
      dayIndex: 1,
      regionIds: ['lodging'],
      stops: [
        { placeIndex: 0, regionId: 'lodging', dwellMinutes: 90, notes: '' },
        { placeIndex: 1, regionId: 'lodging', dwellMinutes: 90, notes: '' },
      ],
      summary: '',
    };
    const waypoints = buildDayWaypoints(places, day, lodging);
    assert.deepEqual(
      waypoints.map((w) => w.label),
      ['大分機場', '府内城跡', '別府地獄めぐり', '別府温泉'],
    );
  });

  it('starts later days at previous lodging', () => {
    const day: DayDraft = {
      dayIndex: 2,
      regionIds: ['lodging'],
      stops: [{ placeIndex: 1, regionId: 'lodging', dwellMinutes: 60, notes: '' }],
      summary: '',
    };
    const waypoints = buildDayWaypoints(places, day, lodging);
    assert.equal(waypoints[0]?.label, '別府温泉');
    assert.equal(waypoints.at(-1)?.label, '由布院');
  });
});

describe('buildDayRoutes', () => {
  it('aggregates legs and flags over-budget days', async () => {
    const day: DayDraft = {
      dayIndex: 1,
      regionIds: ['lodging'],
      stops: [
        { placeIndex: 0, regionId: 'lodging', dwellMinutes: 90, notes: '' },
        { placeIndex: 1, regionId: 'lodging', dwellMinutes: 90, notes: '' },
      ],
      summary: '',
    };

    let calls = 0;
    const fetchLeg = async (): Promise<RouteLegResult> => {
      calls += 1;
      return {
        durationSeconds: 1800,
        distanceMeters: 20000,
        fetchedAt: new Date().toISOString(),
      };
    };

    const plans = await buildDayRoutes({
      places,
      days: [day],
      lodging,
      dayBudgetMinutes: 100,
      fetchLeg,
    });

    assert.equal(calls, 3);
    assert.equal(plans.length, 1);
    assert.equal(plans[0]!.legs.length, 3);
    assert.equal(plans[0]!.totalDriveSeconds, 5400);
    assert.equal(plans[0]!.totalDwellMinutes, 180);
    assert.equal(plans[0]!.dayLoadMinutes, 270);
    assert.equal(plans[0]!.overBudget, true);
  });

  it('records per-leg errors without aborting the day', async () => {
    const day: DayDraft = {
      dayIndex: 1,
      regionIds: ['lodging'],
      stops: [{ placeIndex: 0, regionId: 'lodging', dwellMinutes: 30, notes: '' }],
      summary: '',
    };

    let n = 0;
    const fetchLeg = async (): Promise<RouteLegResult> => {
      n += 1;
      if (n === 1) throw new Error('boom');
      return {
        durationSeconds: 600,
        distanceMeters: 5000,
        fetchedAt: new Date().toISOString(),
      };
    };

    const plans = await buildDayRoutes({
      places,
      days: [day],
      lodging,
      fetchLeg,
    });

    assert.equal(plans[0]!.legs[0]?.error, 'boom');
    assert.equal(plans[0]!.legs[1]?.durationSeconds, 600);
  });
});
