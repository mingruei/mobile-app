# 攻城師 — Apple App Store 上架指南

本 App 使用 **Expo EAS Build** 雲端建置，不需在本機安裝完整 Xcode 即可產生 `.ipa` 並提交審核。

## 前置條件

| 項目 | 說明 |
|------|------|
| Apple Developer Program | [developer.apple.com](https://developer.apple.com/programs/) 年費約 USD 99 |
| Expo 帳號 | [expo.dev](https://expo.dev)（專案已連結 `projectId: a381aae1-...`） |
| EAS CLI | `npm install -g eas-cli` 後執行 `eas login` |
| Bundle ID | `com.japancastles.map`（須與 `app.config.ts` 一致） |

## 第一步：Apple Developer 設定

1. 登入 [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list)
2. 建立 **App ID** → 類型 App → Bundle ID：**Explicit** → `com.japancastles.map`
3. 啟用能力（若審核詢問）：**Sign In with Apple** 非必須（本 App 使用 Google）；定位為使用時權限即可

## 第二步：App Store Connect 建立 App

1. 登入 [App Store Connect](https://appstoreconnect.apple.com/)
2. **我的 App** → **＋** → **新增 App**
3. 建議填寫：
   - **名稱**：攻城師
   - **主要語言**：繁體中文
   - **Bundle ID**：選 `com.japancastles.map`
   - **SKU**：例如 `japan-castles-map`
4. 記下 **Apple ID**（數字，例如 `6751234567`）→ 填入 `eas.json` 的 `ascAppId`
5. 記下 **Team ID**（Developer 帳號 Membership 頁面）→ 填入 `eas.json` 的 `appleTeamId`

編輯 `eas.json`：

```json
"ios": {
  "appleTeamId": "AB12CD34EF",
  "ascAppId": "6751234567"
}
```

## 第三步：EAS 環境變數（雲端建置必備）

本機 `.env` **不會**自動上傳到 EAS。請在專案目錄執行（值來自你的 `.env`）：

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://....supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJ..."
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value "...apps.googleusercontent.com"
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID --value "...apps.googleusercontent.com"
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID --value "...apps.googleusercontent.com"
```

確認：

```bash
eas secret:list
```

## 第四步：建置 iOS 正式版

```bash
cd ~/Projects/japan-castles-map
npm run build:ios
# 等同：eas build --platform ios --profile production
```

- 首次建置會詢問 **Apple 憑證**：選 **Let EAS handle credentials**（建議）
- 建置完成後在 [expo.dev](https://expo.dev) 下載 `.ipa` 或直接用 submit

**版本號**：`app.config.ts` 的 `version`（例如 `1.1.0`）；build number 由 EAS `autoIncrement` 自動遞增。

## 第五步：提交 App Store

```bash
npm run submit:ios
# 等同：eas submit --platform ios --profile production --latest
```

或手動：App Store Connect → 你的 App → **TestFlight** / **App  Store** → 上傳 `.ipa`（Transporter App）。

首次 submit 可能需輸入 Apple ID 與 App-specific password（[appleid.apple.com](https://appleid.apple.com) → 安全碼 → App 專用密碼）。

## 第六步：App Store Connect 必填資料

審核前請完成：

### 1. App 隱私權

本 App 會用到：

| 資料 | 用途 |
|------|------|
| 精確位置 | 篩選所在都道府縣（可拒絕，仍可使用） |
| 電子郵件 | Google 登入（選用雲端同步） |
| 使用者內容 | 登城紀錄（存在本機＋選用 Supabase） |

### 2. 隱私權政策 URL

**必填**（有 Google 登入與位置權限）。可放在 GitHub Pages、Notion 公開頁等，需說明：

- 收集哪些資料、用途、是否分享第三方（Google、Supabase）
- 如何刪除帳號／資料（Supabase 後台或來信）

### 3. 螢幕截圖

- iPhone 6.7"（必填，例如 iPhone 15 Pro Max 模擬器）
- 若勾選 iPad：13" iPad 截圖
- 建議：地圖、列表、名城詳情、設定頁

```bash
# 模擬器截圖後拖入 App Store Connect
npx expo run:ios
```

### 4. 出口合規

`app.config.ts` 已設定 `ITSAppUsesNonExemptEncryption: false`（僅 HTTPS，無自訂加密）。App Store Connect 問卷選 **否** 或使用標準加密即可。

### 5. 年齡分級、版權、支援 URL

- 分級問卷：通常 4+（無暴力／賭博內容）
- 支援 URL：可填 GitHub repo 或聯絡 email 頁面

## 第七步：TestFlight → 審核

1. 上傳 build 後等 **Processing**（約 10–30 分鐘）
2. **TestFlight** 先自行安裝測試（登入、地圖、登城紀錄、Google 同步）
3. **App Store** 分頁 → 選 build → **提交審核**

審核通常 1–3 天。

## 常見問題

### Google 登入在 TestFlight 失敗

- 確認 `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` 已設為 EAS secret
- Google Cloud iOS 用戶端 Bundle ID 為 `com.japancastles.map`
- 使用 **production** profile 建置（非 development）

### 雲端同步無效

- 確認四個 `EXPO_PUBLIC_*` secret 皆已設定
- Supabase Google Provider 已啟用

### 版本更新

1. 修改 `app.config.ts` → `version: '1.1.1'`
2. `npm run build:ios && npm run submit:ios`
3. App Store Connect 選新 build 提交

## 指令速查

```bash
eas login
eas secret:list
npm run build:ios
npm run submit:ios
eas build:list --platform ios
```
