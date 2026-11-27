import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DayRoutePlan, SimPlace, SimReport } from './types.ts';

function formatMinutes(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h <= 0) return `${rem} 分`;
  if (rem === 0) return `${h} 小時`;
  return `${h} 小時 ${rem} 分`;
}

function formatDrive(seconds: number): string {
  return formatMinutes(seconds / 60);
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km`;
}

function placeLabel(places: readonly SimPlace[], index: number): string {
  return places[index]?.label ?? `#${index}`;
}

function renderDayRoutes(plan: DayRoutePlan | undefined, dayBudgetMinutes: number | null): string[] {
  if (!plan) return [];
  const lines: string[] = [];
  if (plan.legs.length === 0) {
    lines.push('  路段：無');
  } else {
    lines.push('  路段：');
    for (const leg of plan.legs) {
      const base = `    ${leg.fromLabel} → ${leg.toLabel} · ${formatDrive(leg.durationSeconds)} · ${formatDistance(leg.distanceMeters)}`;
      lines.push(leg.error ? `${base} ⚠ ${leg.error}` : base);
    }
  }
  const budget = dayBudgetMinutes ?? 600;
  const flag = plan.overBudget ? ' · ⚠ 過長' : '';
  lines.push(
    `  當日合計：移動 ${formatDrive(plan.totalDriveSeconds)} · 停留 ${formatMinutes(plan.totalDwellMinutes)} · 總負載 ${formatMinutes(plan.dayLoadMinutes)}（預算 ${formatMinutes(budget)}）${flag}`,
  );
  return lines;
}

export function renderReportText(report: SimReport): string {
  const lines: string[] = [];
  lines.push('# 區域群集／住宿分派模擬報告');
  lines.push(`產生時間：${report.generatedAt}`);
  lines.push(`景點數：${report.places.length}`);
  lines.push(`建議天數：${report.capacity.suggestedDayCount}（行程 ${report.capacity.existingDayCount} 天）`);
  if (report.corridor) {
    lines.push(
      `走廊：${report.corridor.start.label} → ${report.corridor.end.label}` +
        (report.corridorMaxKm != null ? `（±${report.corridorMaxKm} km）` : ''),
    );
  }
  if (report.mustVisitPatterns.length > 0) {
    lines.push(
      `必去：已配對 ${report.mustVisitMatched.length}／未配對 ${report.mustVisitUnmatched.length}`,
    );
    for (const m of report.mustVisitMatched) {
      lines.push(`  ✓ ${m.pattern} → ${m.label}`);
    }
    for (const u of report.mustVisitUnmatched) {
      lines.push(`  ✗ ${u}`);
    }
  }
  lines.push('');

  const pending = report.capacity.pendingUserDecision;
  if (pending.length > 0) {
    lines.push('## 待決定（？）');
    for (const item of pending) {
      const reason = item.reason ? ` [${item.reason}]` : '';
      lines.push(
        `- ${placeLabel(report.places, item.placeIndex)} · 距參考 ${item.distanceKm.toFixed(1)} km${reason}`,
      );
    }
    lines.push('');
  }

  lines.push('## 每日行程');
  for (const day of report.capacity.days) {
    const lodgingNight = report.lodging?.nights.find((n) => n.dayIndex === day.dayIndex);
    const lodgingLabel = lodgingNight ? ` · 宿 ${lodgingNight.lodging.label}` : '';
    const aiSummary =
      report.ai?.days.find((d) => d.dayIndex === day.dayIndex)?.summary || day.summary;
    lines.push(`### Day ${day.dayIndex}${lodgingLabel}`);
    if (aiSummary) lines.push(`  ${aiSummary}`);
    if (day.stops.length === 0) {
      lines.push('  （無景點）');
    } else {
      for (const stop of day.stops) {
        const must = stop.notes.includes('must') ? ' ★' : '';
        lines.push(
          `  - ${placeLabel(report.places, stop.placeIndex)}（停留 ${stop.dwellMinutes} 分）${must}`,
        );
      }
    }
    const route = report.dayRoutes?.find((r) => r.dayIndex === day.dayIndex);
    lines.push(...renderDayRoutes(route, report.dayBudgetMinutes));
    lines.push('');
  }

  if (report.dayRoutes && report.dayRoutes.some((r) => r.overBudget)) {
    lines.push('## 過長天數');
    for (const plan of report.dayRoutes.filter((r) => r.overBudget)) {
      lines.push(
        `- Day ${plan.dayIndex}：總負載 ${formatMinutes(plan.dayLoadMinutes)}` +
          (report.dayBudgetMinutes != null
            ? ` > 預算 ${formatMinutes(report.dayBudgetMinutes)}`
            : ''),
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function writeReportFiles(outDir: string, report: SimReport): {
  jsonPath: string;
  textPath: string;
} {
  mkdirSync(outDir, { recursive: true });
  const jsonPath = `${outDir}/report.json`;
  const textPath = `${outDir}/report.txt`;
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  writeFileSync(textPath, renderReportText(report), 'utf8');
  return { jsonPath, textPath };
}
