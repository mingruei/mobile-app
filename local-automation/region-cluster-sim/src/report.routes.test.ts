import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderReportText } from './report.ts';
import type { SimReport } from './types.ts';

describe('renderReportText day routes', () => {
  it('prints legs and over-budget load', () => {
    const report: SimReport = {
      places: [
        {
          placeIndex: 0,
          label: '府内城跡',
          latitude: 33.24,
          longitude: 131.61,
          hasCoords: true,
        },
      ],
      cluster: {
        regions: [],
        outliers: [],
        unlocated: [],
        params: { mergeKm: 18, farKm: 45, outlierKm: 55 },
      },
      capacity: {
        days: [
          {
            dayIndex: 1,
            regionIds: ['lodging'],
            stops: [
              {
                placeIndex: 0,
                regionId: 'lodging',
                dwellMinutes: 90,
                notes: 'must-visit',
              },
            ],
            summary: '住宿：別府',
          },
        ],
        suggestedDayCount: 1,
        existingDayCount: 1,
        fitsTripDays: true,
        extraDaysNeeded: 0,
        pendingUserDecision: [],
        params: {
          maxStopsPerDay: 4,
          maxRegionSpanKmPerDay: 80,
          defaultDwellMinutes: 90,
        },
      },
      corridor: null,
      corridorMaxKm: null,
      lodging: null,
      mustVisitPatterns: [],
      mustVisitMatched: [],
      mustVisitUnmatched: [],
      dayRoutes: [
        {
          dayIndex: 1,
          legs: [
            {
              fromLabel: '大分機場',
              toLabel: '府内城跡',
              durationSeconds: 1500,
              distanceMeters: 18000,
            },
            {
              fromLabel: '府内城跡',
              toLabel: '別府温泉',
              durationSeconds: 1200,
              distanceMeters: 14000,
            },
          ],
          totalDriveSeconds: 2700,
          totalDistanceMeters: 32000,
          totalDwellMinutes: 90,
          dayLoadMinutes: 135,
          overBudget: true,
        },
      ],
      dayBudgetMinutes: 100,
      ai: null,
      regionNames: {},
      generatedAt: '2026-01-01T00:00:00.000Z',
    };

    const text = renderReportText(report);
    assert.match(text, /大分機場 → 府内城跡 · 25 分 · 18 km/);
    assert.match(text, /當日合計：移動 45 分 · 停留 1 小時 30 分 · 總負載 2 小時 15 分/);
    assert.match(text, /過長/);
    assert.match(text, /## 過長天數/);
  });
});
