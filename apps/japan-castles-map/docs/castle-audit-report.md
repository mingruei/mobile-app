# 名城資料校正報告

對照來源：公益財団法人日本城郭協会（日本100名城・続日本100名城）、
`data-source/shiro02.csv`（百名城座標）、`castleinfo-100.json`（官網參考）。

## 摘要

- JSON 格式：正常（200 筆 id 1–200 完整）
- 編號/城名不一致：**0 筆**（已全部對齊日本城郭協会）
- 所在地疑慮：**0 筆**
- 主座標疑慮：**0 筆**
- content 缺漏：**0 筆**
- content 座標距 castles.json >25km：**0 筆**
- content subtitle 疑慮：38 筆（多為繁中慣用字，屬正常差異）
- 官網與 castleinfo 不同：95 筆（舊參考資料，多數 app URL 較新）

## 本次已修正

### 城名（castles.json `name`）
| 編號 | 修正前 | 修正後 |
|------|--------|--------|
| 16 | みのわ城 | 箕輪城 |
| 17 | 新田金山城 | 金山城 |
| 54 | 大坂城 | 大阪城 |
| 72 | 吉田郡山城 | 郡山城 |
| 88 | 吉野ヶ里遺跡 | 吉野ヶ里 |
| 97 | 鹿児島城 | 鹿児島城(黎明館) |
| 133 | 鮫尾城 | 鮫ケ尾城 |
| 168 | 若桜鬼ヶ城 | 若桜鬼ケ城 |
| 174 | （已正確） | 大内氏館・高嶺城 |

### 所在地
- **#153** 多気郡多気町 → **津市美杉町上多気**（協会表記：三重県津市）
- **#184** 佐賀県基山町 → **福岡県筑紫野市、佐賀県基山町**（跨縣史跡，協会以筑紫野市為主）

### 座標（誤貼其他城／經度 typo）
- **#72** content 御印經度 122→132
- **#98** castles 御印座標（誤為根室）→ 今帰仁正確座標
- **#100** content 第二御印點（誤為根室）→ 首里城
- **#101** castles 停車（誤為松山城）→ 志苔館
- **#103** content 青森市中世之館（誤為愛媛）→ 青森市
- **#104** content 停車（誤為宇和島）→ 九戸城
- **#110** content 停車（誤為久留米）→ 三春城
- **#135** content 御印／停車（誤為一乗谷）→ 増山城
- **#151** castles 停車經度 134→137
- **#199** castles 御印（誤為原城）→ 座喜味城

### 官網（已確認 404 並更新）
- **#97** → `https://www.pref.kagoshima.jp/reimeikan/index.html`
- **#153** 補上 → 津市公式頁
- **#174** → 山口市歴史文化資源頁
- **#184** → 筑紫野市公式頁

### content subtitle
- **#16,17,54,72,88,133,168,174** 對齊協会城名
- **#32** 春春山城 → 春日山城（錯字）

---

## 摘要（自動稽核）

## 官網與 castleinfo 不同（僅參考）

- **#2** 目前 https://www.hakodate-jyoho.com/goryokaku/
- **#3** 目前 http://www.asuka-g.co.jp/matsumae/
- **#4** 目前 http://www.hirosakipark.jp/
- **#5** 目前 https://www.city.hachinohe.aomori.jp/section/art_museum/nejo/
- **#6** 目前 http://www.morioka-park.com/odori/
- **#7** 目前 https://www.pref.miyagi.jp/site/tagajo-kinenskan/
- **#8** 目前 https://www.honmarukaikan.com/
- **#9** 目前 https://www.city.akita.lg.jp/kanko/kanrenshisetsu/1003643.html
- **#10** 目前 http://www.city.yamagata-yamagata.lg.jp/kakuka/bunka/koen/shisetsu/kojojo/
- **#11** 目前 https://www.city.nihonmatsu.lg.jp/site/kankou/kasumigajo.html
- **#12** 目前 https://www.tsurugajo.com/
- **#13** 目前 http://shirakawa315.com/sightseeing/komine.html
- **#14** 目前 https://www.city.mito.lg.jp/site/kankoubunka/4122.html
- **#15** 目前 http://www.bannaji.org/
- **#16** 目前 https://www.city.takasaki.gunma.jp/docs/2014010701672/
- **#17** 目前 https://www.city.ota.gunma.jp/page/1012117.html
- **#18** 目前 https://www.town.yorii.saitama.jp/site/hachigatashijo/
- **#19** 目前 https://www.city.kawagoe.saitama.jp/welcome/kankospot/hommarugoten.html
- **#20** 目前 https://www.city.sakura.lg.jp/soshiki/sakurajoshi_koen/
- **#21** 目前 https://www.fureai-cloud.jp/toukyou-kouen/home/index/eastgarden
- **#22** 目前 https://www.city.hachioji.tokyo.jp/kankobunka/004/005/p005171.html
- **#25** 目前 https://www.pref.yamanashi.jp/maizoko/ko-jo/index.html
- **#26** 目前 https://www.nagano-cvb.or.jp/modules/sightseeing/page/24
- **#27** 目前 https://uedajo.myu-tech.jp/
- **#28** 目前 https://www.city.komoro.lg.jp/soshiki/toshikeikakuka/kaikoen/index.html
- **#29** 目前 https://www.matsumoto-castle.jp/
- **#30** 目前 https://inashi-kankoukyoukai.jp/contents/archives/28
- **#31** 目前 http://www.city.shibata.lg.jp/kanko/shibatajo/
- **#32** 目前 https://www.joetsu-kanko.net/kanren/kasugayama/
- **#33** 目前 https://www.takaoka-kojyoho.jp/

- …另有 65 筆

## content subtitle 疑慮

- **#1** 協会「根室半島チャシ跡群」／subtitle「根室半島查西跡群」
- **#12** 協会「会津若松城」／subtitle「會津若松城」
- **#14** 協会「水戸城」／subtitle「水戶城」
- **#21** 協会「江戸城」／subtitle「江戶城」
- **#31** 協会「新発田城」／subtitle「新發田城」
- **#35** 協会「金沢城」／subtitle「金澤城」
- **#37** 協会「一乗谷城」／subtitle「一乘谷城」
- **#50** 協会「彦根城」／subtitle「彥根城」
- **#52** 協会「観音寺城」／subtitle「觀音寺城」
- **#53** 協会「二条城」／subtitle「二條城」
- **#59** 協会「姫路城」／subtitle「姬路城」
- **#60** 協会「赤穂城」／subtitle「赤穗城」
- **#69** 協会「鬼ノ城」／subtitle「鬼之城」
- **#73** 協会「広島城」／subtitle「廣島城」
- **#74** 協会「岩国城」／subtitle「岩國城」
- **#76** 協会「徳島城」／subtitle「德島城」
- **#78** 協会「丸亀城」／subtitle「丸龜城」
- **#90** 協会「平戸城」／subtitle「平戶城」
- **#94** 協会「大分府内城」／subtitle「大分府內城」
- **#97** 協会「鹿児島城(黎明館)」／subtitle「鹿兒島城」
- **#98** 協会「今帰仁城」／subtitle「今歸仁城」
- **#102** 協会「上ノ国勝山館」／subtitle「上之國勝山館」
- **#104** 協会「九戸城」／subtitle「九戶城」
- **#108** 協会「鶴ヶ岡城」／subtitle「鶴岡城」
- **#109** 協会「米沢城」／subtitle「米澤城」
- **#114** 協会「唐沢山城」／subtitle「唐澤山城」
- **#123** 協会「滝山城」／subtitle「瀧山城」
- **#125** 協会「小机城」／subtitle「小機城」
- **#135** 協会「増山城」／subtitle「增山城」
- **#139** 協会「佐柿国吉城」／subtitle「佐柿國吉城」
- **#145** 協会「興国寺城」／subtitle「興國寺城」
- **#148** 協会「浜松城」／subtitle「濱松城」
- **#153** 協会「多気北畠氏城館」／subtitle「北畠氏館」
- **#162** 協会「出石城・有子山城」／subtitle「出石城‧有子山城」
- **#163** 協会「黒井城」／subtitle「黑井城」
- **#170** 協会「浜田城」／subtitle「濱田城」
- **#180** 協会「岡豊城」／subtitle「岡豐城」
- **#192** 協会「角牟礼城」／subtitle「角牟禮城」
