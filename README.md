# mobile-app

Monorepo for mobile apps.

## Apps

- `apps/japan-castles-map` — 攻城師（日本百名城 / 続百名城地圖）
- `apps/michi-no-eki-magnets` — 日本道之駅磁鐵收集帳
- `apps/hokkaido-rural-magnets` — 北海道鄉村標誌磁鐵收集帳

## Setup

```bash
npm install
```

## Development

```bash
# Japan Castles Map
npm run castles:start
npm run castles:test
npm run castles:tsc

# Michi-no-Eki Magnets
npm run michi:start
npm run michi:test
npm run michi:tsc

# Hokkaido Rural Magnets
npm run hokkaido:ios      # first time: build dev client for simulator
npm run hokkaido:start
npm run hokkaido:test
npm run hokkaido:tsc
```

EAS builds run from the app directory:

```bash
cd apps/japan-castles-map
eas build --platform ios --profile production
```
