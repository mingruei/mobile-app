# region-cluster-sim

Offline simulator for wishlist clustering, lodging-day assignment, must-visit pinning, and optional Google Routes day legs.

## Setup

```bash
cd local-automation/region-cluster-sim
npm install
```

Optional keys (loaded from `apps/travel-plan/.env`, `apps/michi-no-eki-magnets/.env`, or local `.env`):

- `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` / `GOOGLE_MAPS_API_KEY` — for `--routes`
- `OPENAI_API_KEY` — optional enrich (`OPENAI_ENRICH=1` to call the API)

## Run

```bash
npm run sim -- --kml fixtures/kyushu-sample.kml --days 9 \
  --start oita --end saga \
  --lodging fixtures/kitakyushu-lodging.json \
  --must fixtures/kitakyushu-must.json \
  --routes --out output/kitakyushu-routes
```

Flags:

| Flag | Meaning |
|------|---------|
| `--routes` | Call Google Routes `computeRoutes` for each day chain |
| `--avoid-tolls` | Prefer toll-free drive |
| `--day-budget-min <n>` | Mark days whose drive+dwell exceeds N minutes (default 600) |

Without `--routes`, no Maps quota is used.

For offline report checks without a Maps key, set `ROUTES_MOCK=1` (crow-flight estimate at ~50 km/h).

## Day route model

```
Day1 start = tripStart (airport)
Other days start = previous lodging
Stops = assigned places in order
End = tonight's lodging
```

Same-coordinate legs short-circuit to 0 without an API call.
