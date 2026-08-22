# 北海道鄉村標誌磁鐵收集帳 (Hokkaido Rural Magnets)

Cross-platform mobile app (iOS + Android) built with **Expo** and **React Native**. Collect **北海道鄉村標誌磁鐵** (Hokkaido rural logo souvenir magnets):

- Interactive map and list
- Visit and magnet collection progress
- Photo upload, groups, and ZIP backup/sync

## Features

- OpenStreetMap with **179 municipality area polygons** across Hokkaido (no API key required)
- Filter by Hokkaido sub-area, progress, and groups
- Location detail screen with visit tracking and magnet photos
- Optional **cloud sync** for location data via Supabase
- Works on iPhone, iPad, Android, and web (PWA)

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Expo CLI](https://docs.expo.dev/) (via `npx expo`)

## Setup

```bash
cd ~/Projects/mobile-app
npm install
```

## iOS development

This app uses **Expo Dev Client** (not Expo Go). The simulator must have the native app installed first.

```bash
# First time (or after native dependency changes): build + install dev client (~5 min)
npm run hokkaido:ios

# Daily development: start Metro bundler
npm run hokkaido:start
```

After the dev client is installed, `npm run hokkaido:start` can connect to the simulator. Do **not** press `i` in Expo CLI before running `hokkaido:ios` once — that error means the dev build is missing.

If CocoaPods fails with an encoding error, run:

```bash
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
npm run hokkaido:ios
```

## Data source

Location data is built from [code4fukui/localgovjp](https://github.com/code4fukui/localgovjp) (179 Hokkaido municipalities).

```bash
# Fetch latest municipality data and regenerate assets/hokkaido-countries.json
npm run build:stations

# Rebuild from cached data-source/localgovjp-hokkaido.json
npm run build:stations:offline

# Regenerate map polygons only (from data-source/hokkaido_map_web_4612.geojson)
npm run build:boundaries -w hokkaido-rural-magnets
```

Map boundaries come from [北海道オープンデータ](https://www.harp.lg.jp/opendata/dataset/1379.html) (`hokkaido_map_web_4612.geojson`, simplified for web). The app shows **179 municipality polygons**; 札幌市 is a single city polygon. Attribution: 北海道（国土数値情報行政区域データを加工）.

```bash
# Download latest boundary source (optional; cached copy lives in data-source/)
curl -L "https://www.harp.lg.jp/opendata/dataset/1379/resource/2854/hokkaido_map_web_4612.geojson" \
  -o apps/hokkaido-rural-magnets/data-source/hokkaido_map_web_4612.geojson

## Android release (AAB)

Local build (uses `android/keystore.properties`, same setup as other apps in this monorepo):

```bash
# Copy signing config from an existing app if needed:
# cp apps/michi-no-eki-magnets/android/keystore.properties apps/hokkaido-rural-magnets/android/

npm run hokkaido:build:android:local
```

Output: `apps/hokkaido-rural-magnets/android/app/build/outputs/bundle/release/hokkaido-rural-magnets-1.0.0-2.aab`

Verify version code:

```bash
npm run verify:aab -w hokkaido-rural-magnets -- \
  apps/hokkaido-rural-magnets/android/app/build/outputs/bundle/release/hokkaido-rural-magnets-1.0.0-2.aab \
  2
```

Cloud build (EAS):

```bash
cd apps/hokkaido-rural-magnets
eas build --platform android --profile production
```

See `android-keystore.properties.example` for keystore setup.

## License

See [LICENSE](LICENSE).
