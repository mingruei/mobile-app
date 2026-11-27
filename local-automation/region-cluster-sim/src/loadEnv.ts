import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = value;
    }
  }
}

function loadCandidateEnvFiles(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, '../../../apps/travel-plan/.env'),
    resolve(here, '../../../apps/michi-no-eki-magnets/.env'),
    resolve(here, '../.env'),
    resolve(process.cwd(), '.env'),
  ];
  for (const path of candidates) loadEnvFile(path);
}

export function loadOpenAiKeyFromEnvFiles(): string | null {
  loadCandidateEnvFiles();
  const key =
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.EXPO_PUBLIC_OPENAI_API_KEY?.trim() ||
    '';
  return key.length > 0 ? key : null;
}

/** Same Places/Maps key travel-plan & michi use for Routes. */
export function loadGoogleMapsKeyFromEnvFiles(): string | null {
  loadCandidateEnvFiles();
  const key =
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    '';
  return key.length > 0 ? key : null;
}
