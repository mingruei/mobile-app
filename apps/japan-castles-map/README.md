# Japan Castles Map

Cross-platform mobile app (iOS + Android) built with **Expo** and **React Native**. Explore all **200 famous castles of Japan** on an interactive map:

- **日本100名城** (Japan's 100 Famous Castles) — blue markers
- **続日本100名城** (Continued 100 Famous Castles) — red markers

## Features

- OpenStreetMap with 200 castle markers across Japan (no API key required)
- Filter by series, region, and prefecture
- Castle detail screen with visit tracking (登城 / 名城章 / 御城印)
- Optional **cloud sync** to **Supabase** via Google sign-in (no custom server)
- Works on iPhone, iPad, Android, and web (PWA)

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Expo CLI](https://docs.expo.dev/) (via `npx expo`)

For device builds you will also need:

- **iOS:** Xcode + Apple Developer account (for App Store)
- **Android:** Android Studio + Google Play Developer account (for Play Store)

## Setup

```bash
cd apps/japan-castles-map   # from mobile-app repo root
npm install
cp .env.example .env   # optional: cloud sync
```

## Cloud sync (Supabase)

登城紀錄 syncs to your **Supabase** Postgres database. The app uses Google sign-in and talks to Supabase directly — **no Node server to deploy**.

> **Do not put the Postgres connection string in the app.** The mobile app only needs the public **Project URL** and **anon key** from Supabase Dashboard → **Project Settings → API**.

### 1. Run the database schema

In [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**, paste and run:

[`supabase/schema.sql`](supabase/schema.sql)

This creates the `castle_progress` table and row-level security so each user can only access their own data.

### 2. Google Cloud Console (create **3** OAuth clients)

Google rejects invalid redirect URIs on **Web application** clients. You need **three separate** credentials — do not put mobile/deep-link URIs on the Web client.

Open [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).

#### A) Web application (for Supabase + ID token)

**Create credentials → OAuth client ID → Web application**

| Field | Value |
|-------|--------|
| **Authorized JavaScript origins** | `https://lwixlvymyhllspotmjze.supabase.co` |
| **Authorized redirect URIs** | `https://lwixlvymyhllspotmjze.supabase.co/auth/v1/callback` |

Use **HTTPS only**. Do **not** add `exp://`, `japan-castles-map://`, or bare `http://` here — Google will reject them.

Copy the Web client ID → `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `.env`.

#### B) iOS

**Create credentials → OAuth client ID → iOS**

| Field | Value |
|-------|--------|
| **Bundle ID** | `com.japancastles.map` |

Copy → `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.

#### C) Android

**Create credentials → OAuth client ID → Android**

| Field | Value |
|-------|--------|
| **Package name** | `com.japancastles.map` |
| **SHA-1** | From your debug or release keystore (see below) |

Copy → `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`.

Debug SHA-1 (local builds):

```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

For local Play Store `.aab` builds, after `prebuild` create a **machine-local**
`android/keystore.properties` (not committed) with an absolute `storeFile`:

```properties
storeFile=/Users/YOUR_USERNAME/upload-keystore.jks
storePassword=...
keyAlias=...
keyPassword=...
```

See `android-keystore.properties.example`. Do not use `~/` in `storeFile`.

For Play Store builds, also add the **App signing key certificate** SHA-1 from Google Play Console.

### 3. Enable Google in Supabase

1. **Authentication → Providers → Google** → Enable
2. **Client ID** = your **Web** client ID (from step 2A)
3. **Client secret** = Web client secret (from Google Console)
4. If iOS native sign-in still fails with a nonce error after rebuilding, enable **Skip nonce check** in Supabase (fallback for older builds)
5. Save — Supabase shows callback URL `https://lwixlvymyhllspotmjze.supabase.co/auth/v1/callback` (must match step 2A)

### 4. Configure the app

Copy `.env.example` to `.env` and fill in:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://lwixlvymyhllspotmjze.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...   # Dashboard → Project Settings → API → anon public
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...apps.googleusercontent.com
```

Restart Metro after editing `.env` (`npm start`).

In the app: **設定** → **儲存登城紀錄至雲端** → **使用 Google 登入**.

> **Expo Go does not work** for Google sign-in. The old browser flow used `exp://192.168.x.x:8081` redirect URIs, which Google rejects. Use a **development build** instead:
>
> ```bash
> npx expo run:ios
> # or
> npx expo run:android
> ```
>
> The app now uses the native Google Sign-In SDK (no browser redirect). You still need **Web + iOS/Android** OAuth clients in Google Cloud Console, and **Web client ID** in `.env` (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`) so Supabase receives a valid ID token.

### Where to find Supabase values

| Variable | Location in Supabase Dashboard |
|----------|--------------------------------|
| `EXPO_PUBLIC_SUPABASE_URL` | **Project Settings → API → Project URL** |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | **Project Settings → API → anon public** |

The **Postgres connection string** (`postgresql://postgres:...@db....supabase.co:5432/postgres`) is for SQL tools and migrations only — **never** ship it in the mobile app.

## Run locally

```bash
npm start
```

Then scan the QR code with **Expo Go**, or press `i` for iOS simulator / `a` for Android emulator.

For web:

```bash
npm run web
```

## Castle data

Castle data used by the app is edited directly in:

- `assets/castles.json` — locations, metadata, and coordinates
- `assets/i18n/castle-content.zh-Hant.json` — Traditional Chinese detail overlays

Source attributions:

- **日本100名城** coordinates come from [100sen.cyber-ninja.jp](https://100sen.cyber-ninja.jp/) (CC-friendly open survey data)
- **続日本100名城** list follows the [Japan Castle Association](https://jokaku.jp/business/great-castles-sequel/) official selection
- Metadata for the first 100 castles is enriched from [tcunningham203/100-famous-castles](https://github.com/tcunningham203/100-famous-castles)

To compare against upstream sources without touching app data:

```bash
python3 scripts/build-castles-json.py
```

This writes `data-source/castles.generated.json` only. It does **not** overwrite `assets/castles.json` or `assets/i18n/castle-content.zh-Hant.json`.

### Remote castle data (Supabase Storage)

The app ships with bundled castle JSON and checks Supabase Storage on launch for a newer full bundle. If the network is slow or unavailable, it keeps the current data and tries again next launch.

1. In Supabase Dashboard → **Storage**, create a **public** bucket named `castle-data`.
2. Upload these three files from the repo:
   - `assets/castles.json`
   - `assets/i18n/castle-content.zh-Hant.json`
   - `assets/data-manifest.json`
3. Whenever you publish new data, edit the JSON files, bump `"version"` in `assets/data-manifest.json` (or run `npm run generate:castle-data-manifest` and increment version manually), then re-upload all three files.

The app reads from:

`{EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/castle-data/...`

No partial updates: a successful sync replaces the full castles list and zh-Hant content overlay together.

## Project structure

```
App.tsx                  # Main screen
components/
  CastleMap.tsx          # OpenStreetMap + markers (native WebView)
  CastleMap.web.tsx      # OpenStreetMap + markers (web)
  CastleDetailScreen.tsx # Castle detail + visit checkboxes
assets/castles.json      # 200 castle records
scripts/build-castles-json.py
```

## Build for stores

### Google Play (Android)

**Prerequisites**

1. [Google Play Console](https://play.google.com/console) developer account (one-time USD 25 fee)
2. [Expo account](https://expo.dev/signup) (free tier works)
3. Git repository with at least one commit (required by EAS Build)

**One-time setup**

```bash
cd apps/japan-castles-map   # from mobile-app repo root
npm install -g eas-cli   # or use: npx eas-cli
eas login
git add . && git commit -m "Prepare for Google Play release"
eas build:configure      # links project to Expo if prompted
```

In [Google Play Console](https://play.google.com/console), create an app and use this package name:

`com.japancastles.map`

It must match `app.config.ts` exactly.

**Build the release (.aab)**

```bash
npm run build:android
# same as: eas build --platform android --profile production
```

EAS builds an **Android App Bundle** (`.aab`) in the cloud. Download it from the link in the terminal or from [expo.dev](https://expo.dev).

**Upload to Google Play**

Option A — manual (simplest for first release):

1. Play Console → your app → **Testing → Internal testing** (or Production)
2. **Create new release** → upload the `.aab`
3. Complete store listing, content rating, privacy policy, and screenshots
4. Submit for review

Option B — EAS Submit (after setting up a Google service account):

```bash
npm run submit:android
```

**Before each update**

- Bump `version` in `app.config.ts` (e.g. `1.0.1`)
- `versionCode` is auto-incremented by EAS (`autoIncrement: true` in `eas.json`)

### iOS (App Store)

完整步驟見 **[docs/app-store-ios-zh-Hant.md](docs/app-store-ios-zh-Hant.md)**。

```bash
eas login
# 設定 EAS secrets（見文件）後：
npm run build:ios
npm run submit:ios
```

在 `eas.json` 填入你的 `appleTeamId` 與 `ascAppId`（App Store Connect 建立 App 後取得）。

## License

MIT — see [LICENSE](LICENSE). Castle data attributions are noted in `scripts/build-castles-json.py`.
