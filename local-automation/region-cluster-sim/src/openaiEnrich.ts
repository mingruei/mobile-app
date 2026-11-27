import type { AiEnrichment, CapacityResult, ClusterResult, SimPlace } from './types.ts';
import { loadOpenAiKeyFromEnvFiles } from './loadEnv.ts';

/**
 * Optional AI enrich — skipped when no key or --no-ai.
 * Kept minimal: region names + day summaries only.
 */
export async function enrichWithOpenAi(options: {
  places: readonly SimPlace[];
  cluster: ClusterResult;
  capacity: CapacityResult;
  apiKey?: string | null;
}): Promise<AiEnrichment | null> {
  const apiKey = options.apiKey ?? loadOpenAiKeyFromEnvFiles();
  if (!apiKey) return null;

  const regionNames = options.cluster.regions.map((region) => {
    const labels = region.placeIndexes
      .map((i) => options.places[i]?.label)
      .filter(Boolean)
      .slice(0, 3)
      .join('、');
    return {
      regionId: region.regionId,
      name: labels || region.regionId,
    };
  });

  const days = options.capacity.days.map((day) => ({
    dayIndex: day.dayIndex,
    summary:
      day.summary ||
      day.stops
        .map((s) => options.places[s.placeIndex]?.label)
        .filter(Boolean)
        .slice(0, 3)
        .join(' → '),
  }));

  // Soft pass without calling OpenAI when we only need deterministic labels for sim.
  // Call the API only if OPENAI_ENRICH=1 to avoid surprise spend.
  if (process.env.OPENAI_ENRICH !== '1') {
    return { regions: regionNames, days, outliers: [] };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You name travel regions and summarize day itineraries in Traditional Chinese. Return JSON {regions:[{regionId,name}],days:[{dayIndex,summary}],outliers:[]}.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              regions: options.cluster.regions.map((r) => ({
                regionId: r.regionId,
                places: r.placeIndexes.map((i) => options.places[i]?.label),
              })),
              days: options.capacity.days.map((d) => ({
                dayIndex: d.dayIndex,
                stops: d.stops.map((s) => options.places[s.placeIndex]?.label),
              })),
            }),
          },
        ],
      }),
    });
    if (!response.ok) return { regions: regionNames, days, outliers: [] };
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return { regions: regionNames, days, outliers: [] };
    const parsed = JSON.parse(content) as AiEnrichment;
    return {
      regions: parsed.regions?.length ? parsed.regions : regionNames,
      days: parsed.days?.length ? parsed.days : days,
      outliers: parsed.outliers ?? [],
    };
  } catch {
    return { regions: regionNames, days, outliers: [] };
  }
}
