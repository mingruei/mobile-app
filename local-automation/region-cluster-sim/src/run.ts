#!/usr/bin/env node
import { resolve } from 'node:path';
import { runPipeline } from './pipeline.ts';

function printHelp(): void {
  console.log(`Usage: npm run sim -- --kml <path> --days <n> [options]

Options:
  --kml <path>              KML wishlist
  --days <n>                Trip day count
  --out <dir>               Output directory (default: output/latest)
  --start <airport>         Corridor / trip start preset (oita|saga|fukuoka)
  --end <airport>           Corridor / trip end preset
  --corridor-max-km <n>     Max distance from corridor (default 70)
  --lodging <path>          Lodging schedule JSON
  --must <path>             Must-visit patterns JSON
  --routes                  Compute Google Routes legs (requires API key + lodging)
  --avoid-tolls             Prefer toll-free drive routes
  --day-budget-min <n>      Day load budget minutes (default 600)
  --merge-km <n>            Cluster merge distance
  --max-stops <n>           Max stops per day
  --no-ai                   Skip AI enrich
  --help                    Show help
`);
}

function readArg(args: string[], name: string): string | null {
  const idx = args.indexOf(name);
  if (idx < 0) return null;
  return args[idx + 1] ?? null;
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function readNumber(args: string[], name: string, fallback?: number): number | undefined {
  const raw = readArg(args, name);
  if (raw == null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Invalid number for ${name}: ${raw}`);
  return n;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || hasFlag(args, '--help')) {
    printHelp();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const kml = readArg(args, '--kml');
  if (!kml) throw new Error('Missing --kml');
  const days = readNumber(args, '--days');
  if (days == null || days < 1) throw new Error('Missing or invalid --days');

  const out = readArg(args, '--out') ?? 'output/latest';
  const result = await runPipeline({
    kmlPath: resolve(kml),
    days,
    outDir: resolve(out),
    startAirport: readArg(args, '--start'),
    endAirport: readArg(args, '--end'),
    corridorMaxKm: readNumber(args, '--corridor-max-km'),
    lodgingPath: readArg(args, '--lodging')
      ? resolve(readArg(args, '--lodging')!)
      : null,
    mustPath: readArg(args, '--must') ? resolve(readArg(args, '--must')!) : null,
    enableRoutes: hasFlag(args, '--routes'),
    avoidTolls: hasFlag(args, '--avoid-tolls'),
    dayBudgetMinutes: readNumber(args, '--day-budget-min', 600),
    mergeKm: readNumber(args, '--merge-km'),
    maxStopsPerDay: readNumber(args, '--max-stops'),
    noAi: hasFlag(args, '--no-ai'),
  });

  console.log(`Wrote ${result.textPath}`);
  console.log(`Wrote ${result.jsonPath}`);
  if (result.report.dayRoutes) {
    const over = result.report.dayRoutes.filter((d) => d.overBudget).length;
    console.log(
      `Routes: ${result.report.dayRoutes.length} days` +
        (over > 0 ? ` (${over} over budget)` : ''),
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
