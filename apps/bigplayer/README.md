# BigPlayer 大字播

給長輩用的家用音樂機：按鈕大、字大、顏色分明。記住上次播到哪裡，下次打開接著播。

App ID：`com.invisibleworksop.bigplayer`

## iPhone 路徑（AirDrop 用這個）

歌曲放在 iPhone 的「檔案」App 裡：

**檔案 → 瀏覽 → 我的 iPhone → 大字播**

（英文系統是 Files → Browse → On My iPhone → 大字播）

### 用 AirDrop 放進去

1. 先在 iPhone 安裝並打開一次「大字播」App（資料夾才會出現）。
2. 用 AirDrop 把 `.mp3` / `.m4a` / `.wav` / `.mp4` 傳到 iPhone。
3. 在跳出的預覽點**分享** → **儲存到「檔案」**。
4. 位置選：**我的 iPhone → 大字播** → 儲存。

如果檔案已經在「下載項目」或「最近項目」：

1. 打開「檔案」App。
2. 長按那首歌 → **移動**。
3. 選 **我的 iPhone → 大字播**。

放好後打開 App 就會接著播；離開 App 就會停。用「小聲／大聲」調音量。

`.mp4` 在 **iPhone** 與電腦只播放聲音。在 **iPad** 會播放影片：直立時畫面在上、按鍵在下；橫放時按鍵在右邊。

## 用 Xcode 裝到 iPhone（先做這個）

電腦用 USB 接上 iPhone，解鎖手機，若跳出「要信任這部電腦？」選信任。iOS 16 以上請打開 **設定 → 隱私權與安全性 → 開發者模式**。

在專案根目錄執行：

```bash
npm run bigplayer:xcode
```

這會產生 iOS 專案並打開 Xcode。接著：

1. 上方裝置選你的 **iPhone**（不要選 Simulator）。
2. 左側點最上面的藍色 App 圖示 → **Signing & Capabilities** → **Team** 選你的 Apple Developer 帳號（Team ID `VHX5NF3JWK`）。
3. 按 **Run**（▶）。這是獨立安裝，手機打開就會播，**不用輸入 Expo 網址、也不用開 Metro**。第一次可能要在 iPhone：**設定 → 一般 → VPN 與裝置管理** 信任開發者憑證。

若手機上已有舊的「大字播」（會要你輸入 Expo 網址那個），先刪掉再裝一次。

裝好後打開一次 App，檔案 App 才會出現「大字播」資料夾。

若只要指令安裝、不要開 Xcode：

```bash
npm run bigplayer:ios
```

## 上架 App Store

Bundle ID：`com.invisibleworksop.bigplayer`（僅 iPhone，不含 iPad）。

1. [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list) 新增 App ID，Bundle ID 選 **Explicit**，填 `com.invisibleworksop.bigplayer`。
2. [App Store Connect](https://appstoreconnect.apple.com/) → 我的 App → 新增 App：名稱「大字播」、主要語言繁體中文、選這個 Bundle ID。
3. 記下 App 的數字 **Apple ID**，填進 `apps/bigplayer/eas.json` 的 `submit.production.ios.ascAppId`。
4. 在 `apps/bigplayer` 執行一次 `npx eas init`（把 Expo 專案 ID 寫進設定）。
5. 雲端建置並上傳：

```bash
npm run bigplayer:build:ios
npm run bigplayer:submit:ios
```

首次 EAS 建議選 **Let EAS handle credentials**。Submit 可能要 Apple ID 與 [App 專用密碼](https://appleid.apple.com)。

App Store Connect 還要補：

- **隱私權**：選「不收集資料」。音樂檔只存在使用者手機，App 不上傳。
- **出口合規**：已設 `ITSAppUsesNonExemptEncryption: false`，選不使用非豁免加密。
- **螢幕截圖**：iPhone 6.7"／6.9" 必填（播放畫面、檔案路徑說明即可）。
- **支援 URL／隱私權政策 URL**：即使不收集資料，Connect 通常仍要一個可公開打開的頁面。

## 電腦

把音樂檔放到：

`apps/bigplayer/music/`

然後：

```bash
npm run bigplayer:start
```

或雙擊 `開始播放.command`。瀏覽器打開 `http://127.0.0.1:3456`。

## 測試

```bash
npm run bigplayer:test
```
