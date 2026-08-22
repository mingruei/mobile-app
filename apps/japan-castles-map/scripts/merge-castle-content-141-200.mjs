import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const castlesPath = path.join(projectRoot, "assets", "castles.json");
const contentPath = path.join(
  projectRoot,
  "assets",
  "i18n",
  "castle-content.zh-Hant.json"
);

const TARGET_START = 141;
const TARGET_END = 200;
const TARGET_IDS = Array.from(
  { length: TARGET_END - TARGET_START + 1 },
  (_, idx) => TARGET_START + idx
);

const CONTENT_METADATA = {
  141: {
    subtitle: "郡上八幡城",
    description:
      "郡上八幡城築於戰國時期，天守雖為近代重建，但仍完整保留山城與城下町一體的地形特色。郡上藩以水道與防火町割聞名，登城可同時理解武家治理與町人生活的空間關係。",
    publicTransitDescription:
      "可自郡上八幡站轉乘巴士至城下町，步行上坡約15至20分鐘抵達城址。"
  },
  142: {
    subtitle: "苗木城",
    description:
      "苗木城以巨岩地形構築曲輪與石垣，是日本山城中極具辨識度的懸崖城郭。遠山氏在木曾川沿岸經營此地，留下戰國期地方領主掌握交通與資源的歷史脈絡。",
    publicTransitDescription:
      "可由中津川站搭乘地方巴士至苗木，之後步行前往城址公園。"
  },
  143: {
    subtitle: "美濃金山城",
    description:
      "美濃金山城是森可成、森長可父子的重要據點，亦是織田政權東美濃經營的核心堡壘。城內石垣、枡形與居館遺構顯示其由中世山城向近世城郭過渡的特徵。",
    publicTransitDescription:
      "可由明智站或可兒站轉乘巴士至兼山地區，再步行登城。"
  },
  144: {
    subtitle: "大垣城",
    description:
      "大垣城位於美濃平野交通要衝，關原之戰前夕成為石田三成方的重要據點。現今天守為戰後復興建築，但城地仍清楚呈現水城格局與外堀系統，見證近世軍政防禦思維。",
    publicTransitDescription:
      "自大垣站步行約10分鐘可抵達城址與天守展示區。"
  },
  145: {
    subtitle: "興國寺城",
    description:
      "興國寺城被視為北條早雲崛起的重要舞台，對戰國大名形成史有關鍵意義。遺址保存土壘與堀切，能觀察駿河東部中世城館如何因應權力競爭而擴張。",
    publicTransitDescription:
      "可由原站或沼津站搭乘巴士至浮島地區，再步行至城跡。"
  },
  146: {
    subtitle: "諏訪原城",
    description:
      "諏訪原城由武田勝賴築造，目的是控制大井川渡河與東海道內陸路線。城址以深堀與丸馬出群聞名，是研究武田流築城術的代表案例。",
    publicTransitDescription:
      "由金谷站搭乘社區巴士至諏訪原城入口，步行即可到達主郭區。"
  },
  147: {
    subtitle: "高天神城",
    description:
      "高天神城位於遠江要衝，武田與德川曾為其反覆激戰，被稱為『高天神を制する者は遠州を制す』。城內尾根連結曲輪群與深壕保存良好，能清楚感受戰國攻防壓力。",
    publicTransitDescription:
      "可自掛川站搭乘巴士至高天神入口，沿登山道步行上城。"
  },
  148: {
    subtitle: "濱松城",
    description:
      "濱松城是德川家康壯年前期經營遠江的居城，也因歷代城主多獲升遷而有『出世城』之稱。現場可見野面積石垣與曲輪高低差，呈現近世初期城郭發展樣貌。",
    publicTransitDescription:
      "由浜松駅步行約20分鐘，或搭乘市內巴士至市役所南站下車即達。"
  },
  149: {
    subtitle: "小牧山城",
    description:
      "小牧山城為織田信長早期自清洲移轉據點時所築，對尾張統一具有重要意義。小牧長久手之戰期間此地再成德川與羽柴對峙前線，使城址具雙重歷史層次。",
    publicTransitDescription:
      "可由小牧站轉乘巴士至小牧山前，步行入園後登城。"
  },
  150: {
    subtitle: "古宮城",
    description:
      "古宮城位於奧三河山間，普遍認為與武田氏西進防衛線有密切關聯。城址土塁、堀切與虎口構造保存度高，是小規模山城實戰配置的典型教材。",
    publicTransitDescription:
      "建議自新城站租車或轉乘巴士至作手地區，再步行前往。"
  },
  151: {
    subtitle: "吉田城",
    description:
      "吉田城扼守豐川河口與東海道水陸交通，戰國至江戶皆為三河東部關鍵據點。城址雖多改建為近代公園，但鐵櫓與石垣仍展現近世城郭輪廓。",
    publicTransitDescription:
      "自豊橋駅步行約20分鐘可到吉田城址公園。"
  },
  152: {
    subtitle: "津城",
    description:
      "津城由藤堂高虎整備為近世城郭，將原有城地改造為兼具政務與防禦功能的平城。雖天守不存，外堀與石垣殘跡仍可看出高虎對城郭幾何與導流的規劃能力。",
    publicTransitDescription:
      "由津新町駅步行約10分鐘即可抵達津城址。"
  },
  153: {
    subtitle: "多氣北畠氏城館",
    description:
      "多氣北畠氏城館是伊勢國戰國大名北畠氏的政治與祭祀中樞，兼具館與詰城體系。現地可見庭園、土塁與詰城路線，反映公家系大名在亂世中的地方統治模式。",
    publicTransitDescription:
      "可由松阪站搭乘巴士至北畠神社前，步行參觀館跡與詰城步道。"
  },
  154: {
    subtitle: "田丸城",
    description:
      "田丸城自南北朝期即為伊勢交通防衛節點，至近世成為紀州德川與伊勢支配網絡的一環。城址石垣與堀切高低差鮮明，能觀察平山城反覆擴張的痕跡。",
    publicTransitDescription:
      "田丸駅出站後步行約5至10分鐘即可到田丸城跡。"
  },
  155: {
    subtitle: "赤木城",
    description:
      "赤木城由藤堂高虎在天正年間整備，目的在平定熊野山地並控制要道。山頂曲輪與石垣規模雖不大，但防禦線配置緊湊，體現高虎早期築城手法。",
    publicTransitDescription:
      "建議由熊野市區自駕前往，公車班次較少。"
  },
  156: {
    subtitle: "鎌刃城",
    description:
      "鎌刃城位於琵琶湖東岸交通節點，戰國期由京極氏與淺井氏勢力反覆爭奪。城址沿山脊布置多重曲輪與堀切，是近江中世山城防線的代表之一。",
    publicTransitDescription:
      "可由米原駅搭乘巴士至山腳聚落，再步行登城。"
  },
  157: {
    subtitle: "八幡山城",
    description:
      "八幡山城由豐臣秀次築於安土桃山期，具濃厚近世城下町規劃意圖。雖主體建築不存，但石垣與城道遺構清晰，可連結近江八幡商業城下的形成史。",
    publicTransitDescription:
      "由近江八幡駅搭乘巴士至八幡山纜車口，步行可達城址。"
  },
  158: {
    subtitle: "福知山城",
    description:
      "福知山城由明智光秀整備，是丹波統治與交通控制的重要拠點。現天天守為復興建築，但轉用石塔與墓石的石垣仍具辨識度，反映築城急迫與地域資材利用。",
    publicTransitDescription:
      "福知山駅步行約15分鐘可達福知山城公園。"
  },
  159: {
    subtitle: "芥川山城",
    description:
      "芥川山城為三好長慶進入畿內權力核心時的本據，象徵戰國政權由守護體制走向實力支配。山城曲輪群與急斜面防禦地形仍可辨識，歷史意義高於建築遺存。",
    publicTransitDescription:
      "可由高槻駅轉乘巴士至塚脇，再循登山道前往城址。"
  },
  160: {
    subtitle: "飯盛城",
    description:
      "飯盛城是三好長慶後期政權象徵之一，位於河內與攝津交界制高點。城內曲輪連鎖規模大，能理解戰國畿內大名如何依山勢建立多層防衛與指揮空間。",
    publicTransitDescription:
      "由四条畷駅或野崎駅步行登山約40至60分鐘可達主郭。"
  },
  161: {
    subtitle: "岸和田城",
    description:
      "岸和田城在近世由岡部氏治理，以紀州街道與大阪灣沿岸防備為任務。現天守為復興建築，八陣之庭與堀、石垣共同展現城郭景觀與大名文化。",
    publicTransitDescription:
      "岸和田駅或蛸地蔵駅步行約10分鐘即可抵達岸和田城。"
  },
  162: {
    subtitle: "出石城",
    description:
      "出石城建於近世初期，結合有子山城舊勢力與但馬藩政中心功能。城址保有登城門、石垣與櫓台，並與城下町出石皿蕎麥文化共同構成歷史街區。",
    publicTransitDescription:
      "可由豊岡駅搭乘全但巴士至出石，再步行前往城址。"
  },
  163: {
    subtitle: "黑井城",
    description:
      "黑井城是丹波赤井氏勢力核心，亦為織田與明智進軍丹波時的重要攻防點。山頂主郭與連續堀切保存完整，登城後可俯瞰盆地要道，理解其戰略價值。",
    publicTransitDescription:
      "由黒井駅步行至登山口後登城，單程約40分鐘以上。"
  },
  164: {
    subtitle: "洲本城",
    description:
      "洲本城位於淡路島東岸，戰國至江戶初期兼具海上監視與領國統治功能。紀州系石垣遺構廣布山頂與山腰，形成少見的海城與山城混合景觀。",
    publicTransitDescription:
      "可由洲本巴士中心步行或搭乘計程車前往城址入口。"
  },
  165: {
    subtitle: "大和郡山城",
    description:
      "大和郡山城由筒井氏起，後經豐臣系大名與柳澤氏整備，成為奈良盆地北部政務中心。城址石垣與內堀保存度高，並以金魚之城文化延續城下町記憶。",
    publicTransitDescription:
      "近鉄郡山駅或JR郡山駅步行約15分鐘可達城址。"
  },
  166: {
    subtitle: "宇陀松山城",
    description:
      "宇陀松山城控制伊勢與大和間山道，是中世地方權力與商路監控的重要節點。城下町仍保有傳統街屋與防火町割，與山城遺跡形成完整歷史地景。",
    publicTransitDescription:
      "榛原駅轉乘巴士至大宇陀，再步行前往城下與登山口。"
  },
  167: {
    subtitle: "新宮城",
    description:
      "新宮城位於熊野川河口，為紀州藩南部海陸統治據點，也承擔熊野信仰動線管理。石垣沿高台與水際展開，結合港町地形，展現近世沿岸城郭特色。",
    publicTransitDescription:
      "新宮駅步行約15分鐘即可抵達新宮城跡。"
  },
  168: {
    subtitle: "若櫻鬼城",
    description:
      "若櫻鬼城是因幡山地大型中世山城，透過尾根曲輪群監控若櫻街道。城內石垣、堀切與土塁大規模留存，是山陰地區研究戰國山城的重要遺址。",
    publicTransitDescription:
      "若桜駅步行至登山口後上山，建議預留往返約2至3小時。"
  },
  169: {
    subtitle: "米子城",
    description:
      "米子城建於中海與日本海聯絡點，戰國末至近世初在山陰政局中具關鍵地位。天守雖失，但四重櫓台與高石垣氣勢仍在，能遠眺大山與港灣平野。",
    publicTransitDescription:
      "由米子駅步行約20分鐘可抵山麓公園與登城道。"
  },
  170: {
    subtitle: "濱田城",
    description:
      "濱田城是石見沿岸江戶期濱田藩據點，負責海防與銀山後方統治。城址建築多已不存，但曲輪與石垣遺構仍可讀取近世山城化平山城的防禦邏輯。",
    publicTransitDescription:
      "浜田駅搭乘巴士至城山公園附近，步行上城。"
  },
  171: {
    subtitle: "備中高松城",
    description:
      "備中高松城以天正十年『高松城水攻』聞名，羽柴秀吉在此築堤引水迫使清水宗治開城，是戰國末期戰術轉捩點。現場以水堤遺跡與宗治自刃地紀念碑，重現這場決定天下形勢的戰役。",
    publicTransitDescription:
      "備中高松駅步行約10分鐘可達城跡公園與水攻資料點。"
  },
  172: {
    subtitle: "三原城",
    description:
      "三原城由小早川隆景築於瀨戶內海沿岸，曾是直接臨海的『浮城』。近代鐵道穿越本丸區造成地形改變，但石垣與水際配置仍顯示其海運防禦機能。",
    publicTransitDescription:
      "三原駅出站即鄰接城址，步行可環繞主要遺構。"
  },
  173: {
    subtitle: "新高山城",
    description:
      "新高山城是小早川氏在沼田川流域的戰國本城，與後來三原城形成山城與海城雙核心。山頂曲輪與石垣遺構保存良好，可理解毛利系山陽防衛網絡。",
    publicTransitDescription:
      "可由本郷駅搭乘巴士至山麓，再步行登城。"
  },
  174: {
    subtitle: "高嶺城",
    description:
      "高嶺城位於周防山地，為大內氏與毛利氏勢力消長期的重要據點。遺址以連續土壘與堀切構成，反映中國地方中世山城善用稜線防禦的特徵。",
    publicTransitDescription:
      "山口駅或防府駅轉乘巴士至附近聚落後，再步行登山。"
  },
  175: {
    subtitle: "勝瑞城",
    description:
      "勝瑞城是阿波三好氏在戰國前期經營畿內政治時的本據，兼具城館與港路統治功能。考古發掘顯示其館舍與寺院網絡緊密，反映地方權力與都城文化交流。",
    publicTransitDescription:
      "勝瑞駅步行約10至15分鐘可達勝瑞城館跡。"
  },
  176: {
    subtitle: "一宮城",
    description:
      "一宮城是阿波山地防衛線的重要山城，戰國期與長宗我部、蜂須賀勢力變動密切相關。城址曲輪群沿急峻尾根展開，能明顯觀察中世末期防禦強化痕跡。",
    publicTransitDescription:
      "由徳島駅搭乘巴士至一宮町，再步行至登山口。"
  },
  177: {
    subtitle: "引田城",
    description:
      "引田城位於讚岐東端海陸交會處，戰國期控制瀨戶內航路與阿波通道。山頂曲輪與海側防線並存，是研究沿岸山城戰略布局的代表例。",
    publicTransitDescription:
      "引田駅步行可至城址登山口，往返建議預留2小時以上。"
  },
  178: {
    subtitle: "能島城",
    description:
      "能島城是村上水軍能島村上氏的海上據點，建於潮流湍急的島嶼地形。其價值在於展現戰國海上勢力如何以船隊、潮汐與島嶼防禦構成『海城』體系。",
    publicTransitDescription:
      "可由今治港或宮窪地區參加導覽船，從海上眺望能島城跡。"
  },
  179: {
    subtitle: "河後森城",
    description:
      "河後森城是伊予南部戰國山城，長宗我部與宇和島地方勢力皆曾介入其支配。城址保有大規模畝狀豎堀群，對研究中世末期防禦工事極具價值。",
    publicTransitDescription:
      "可由松丸駅步行前往城址公園與登山道入口。"
  },
  180: {
    subtitle: "岡豐城",
    description:
      "岡豐城是土佐國戰國大名長宗我部氏的本城，見證其統一四國前的權力擴張。現地設有歷史民俗資料館，並保存曲輪地形與土壘，利於理解土佐中世城郭。",
    publicTransitDescription:
      "高知駅轉乘巴士至岡豊城址前，步行即到主要參觀區。"
  },
  181: {
    subtitle: "小倉城",
    description:
      "小倉城是細川、後小笠原諸藩治理北九州的政軍中心，控制關門海峽交通。現天守為復興建築，城下町格局與堀川系統仍清楚呈現近世都市城郭特質。",
    publicTransitDescription:
      "西小倉駅步行約10分鐘即可抵達小倉城與勝山公園。"
  },
  182: {
    subtitle: "水城",
    description:
      "水城是7世紀大宰府防衛網的一部分，以長達數公里的土塁與壕溝阻擋北方進攻。這類古代防禦遺構不同於戰國城郭，卻是理解日本早期國防體制的核心遺址。",
    publicTransitDescription:
      "可由水城駅或都府樓前駅步行前往水城跡展示區。"
  },
  183: {
    subtitle: "久留米城",
    description:
      "久留米城位於筑後川沿岸，江戶期為有馬氏久留米藩政廳所在地。石垣與堀跡仍留存，並與篠山神社空間重疊，反映明治後城地轉用歷程。",
    publicTransitDescription:
      "久留米駅步行約20分鐘可到城址篠山神社周邊。"
  },
  184: {
    subtitle: "基肄城",
    description:
      "基肄城是7世紀為防備唐・新羅聯軍而築的古代山城，與大野城同屬北部九州防衛系統。遺址可見土塁線與城門復原點，對古代軍事史研究意義重大。",
    publicTransitDescription:
      "基山駅轉乘地方巴士或計程車至登山口，再步行上山。"
  },
  185: {
    subtitle: "唐津城",
    description:
      "唐津城由寺澤廣高築於唐津灣畔，兼具海上監視與城下町統治功能。現天天守為復興建築，舞鶴公園高台可俯瞰虹之松原與港灣地形。",
    publicTransitDescription:
      "唐津駅步行約15至20分鐘可達唐津城。"
  },
  186: {
    subtitle: "金田城",
    description:
      "金田城位於對馬島，是7世紀古代山城防衛前線，直接面向朝鮮半島航路。城址保有長距離石塁與城門遺構，顯示古代國防工程的高度組織化。",
    publicTransitDescription:
      "由對馬市區自駕前往最便捷，公共交通班次有限。"
  },
  187: {
    subtitle: "福江城",
    description:
      "福江城（石田城）是幕末少見新建海岸城郭，為五島氏治政中心。其石垣貼近海岸線，結合洋式砲台時代背景，反映幕末防衛觀念轉變。",
    publicTransitDescription:
      "福江港或福江空港可轉乘巴士，於市區下車後步行前往城址。"
  },
  188: {
    subtitle: "原城",
    description:
      "原城是島原之亂最後決戰地，天草四郎率領的一揆軍在此固守並遭幕府軍圍攻。遺址現存石垣與曲輪地形，作為近世宗教政策與社會矛盾的重要歷史現場。",
    publicTransitDescription:
      "可由島原市區搭乘巴士至南有馬地區，再步行至原城跡。"
  },
  189: {
    subtitle: "鞠智城",
    description:
      "鞠智城是7世紀大和政權在九州內陸建立的古代山城據點，負責後方補給與區域防衛。八角形鼓樓復原建築與倉庫群展示，對理解古代官營軍事設施極具幫助。",
    publicTransitDescription:
      "可由熊本市或山鹿市搭乘巴士至附近站點，再轉計程車前往。"
  },
  190: {
    subtitle: "八代城",
    description:
      "八代城是細川氏在江戶初期整備的平城，作為熊本藩南部治理與海防據點。石垣、堀與門跡保存良好，並與城址神社共同維持城地歷史景觀。",
    publicTransitDescription:
      "八代駅搭乘市內巴士至八代宮前，步行即達城址。"
  },
  191: {
    subtitle: "中津城",
    description:
      "中津城由黑田官兵衛、黑田長政父子參與整備，後由細川忠興續修，為著名的沿海平城。其『扇城』石垣與水堀配置是九州近世城郭海防設計代表。",
    publicTransitDescription:
      "中津駅步行約15分鐘即可抵達中津城天守區。"
  },
  192: {
    subtitle: "角牟禮城",
    description:
      "角牟禮城位於久住山系邊緣高地，戰國期由豐後地方勢力經營。石垣與土壘混合的山城遺構明顯，能看出中世末至近世初築城技術交錯。",
    publicTransitDescription:
      "可由豊後森駅步行至登山口，再上山約30至40分鐘。"
  },
  193: {
    subtitle: "臼杵城",
    description:
      "臼杵城由大友宗麟築於丹生島，原本為四周臨海的島城，後因填海與地形改變成陸地城址。石垣與櫓門遺構保存良好，展現九州港灣城郭特色。",
    publicTransitDescription:
      "臼杵駅步行約10分鐘可抵達臼杵城跡公園。"
  },
  194: {
    subtitle: "佐伯城",
    description:
      "佐伯城由毛利高政築於江戶初期，依山就勢形成山頂本丸與山麓御殿區。登城路沿線石垣連續，兼具防禦與景觀效果，是豐後地區代表性山城。",
    publicTransitDescription:
      "佐伯駅轉乘巴士至城山入口，或步行前往登城道。"
  },
  195: {
    subtitle: "延岡城",
    description:
      "延岡城由高橋元種築造，後成內藤氏延岡藩中心，控制日向北部交通。著名千人殺石垣等遺構保留至今，可見近世城郭土木技術與威壓性設計。",
    publicTransitDescription:
      "延岡駅轉乘巴士至城山公園，下車步行可達主要遺構。"
  },
  196: {
    subtitle: "佐土原城",
    description:
      "佐土原城是島津一門伊東氏在日向治理的核心山城，兼具政治象徵與防衛機能。城跡曲輪群分布廣，搭配歷史資料館可完整理解地方藩政脈絡。",
    publicTransitDescription:
      "佐土原駅轉乘巴士至佐土原城址入口，再步行上山。"
  },
  197: {
    subtitle: "志布志城",
    description:
      "志布志城是由多座山城群構成的大規模中世遺址，長期受島津與肝付勢力角逐。其空堀與曲輪網絡範圍廣闊，能觀察南九州山城聯防體系。",
    publicTransitDescription:
      "可由志布志駅轉乘地方巴士至城山周邊，再步行參觀。"
  },
  198: {
    subtitle: "知覽城",
    description:
      "知覽城為薩摩中世山城代表，利用『シラス台地』地質切出深壕與高差防禦。主郭周邊豎堀密集，展現南九州在地地形與築城技術的高度融合。",
    publicTransitDescription:
      "鹿児島中央駅搭乘巴士至知覧，再步行或轉計程車前往城址。"
  },
  199: {
    subtitle: "座喜味城",
    description:
      "座喜味城由名將護佐丸築造，石垣曲線與拱門技術被視為琉球城郭建築傑作。城址為『琉球王國城跡及相關遺產群』世界遺產的一部分，兼具軍事與文化象徵。",
    publicTransitDescription:
      "可由那覇市區搭乘巴士至読谷村座喜味城前，下車步行即達。"
  },
  200: {
    subtitle: "勝連城",
    description:
      "勝連城位於沖繩中部海岸高地，15世紀由阿麻和利統治時達到繁榮高峰。多段曲輪與海景視野極佳，同屬琉球世界遺產，展現琉球王國海洋貿易時代的權力中心樣貌。",
    publicTransitDescription:
      "可由那覇巴士總站搭乘巴士至勝連城跡前，步行進入園區。"
  }
};

function pickNumber(...values) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function resolveCoordinates(castle) {
  const stampLatitude = pickNumber(
    castle.stampLatitude,
    castle.latitude_stamp,
    castle.latitude
  );
  const stampLongitude = pickNumber(
    castle.stampLongitude,
    castle.longitude_stamp,
    castle.longitude
  );
  const parkingLatitude = pickNumber(
    castle.parkingLatitude,
    castle.latitude_parking,
    castle.latitude
  );
  const parkingLongitude = pickNumber(
    castle.parkingLongitude,
    castle.longitude_parking,
    castle.longitude
  );

  if (
    stampLatitude === null ||
    stampLongitude === null ||
    parkingLatitude === null ||
    parkingLongitude === null
  ) {
    throw new Error(`Missing coordinates for castle id ${castle.id}`);
  }

  return {
    stampLatitude,
    stampLongitude,
    parkingLatitude,
    parkingLongitude
  };
}

function buildEntry(castle, metadata) {
  const {
    stampLatitude,
    stampLongitude,
    parkingLatitude,
    parkingLongitude
  } = resolveCoordinates(castle);

  return {
    subtitle: metadata.subtitle,
    description: metadata.description,
    stampLocations: [
      {
        label: `${metadata.subtitle}百名城印章設置處`,
        googleLabel: castle.name,
        latitude: stampLatitude,
        longitude: stampLongitude
      }
    ],
    driving: {
      parkingLocations: [
        {
          label: `${metadata.subtitle}停車場`,
          googleLabel: `${castle.name} 駐車場`,
          latitude: parkingLatitude,
          longitude: parkingLongitude
        }
      ]
    },
    publicTransit: {
      googleDestination: castle.name,
      description: metadata.publicTransitDescription
    }
  };
}

async function main() {
  const [castlesRaw, contentRaw] = await Promise.all([
    fs.readFile(castlesPath, "utf8"),
    fs.readFile(contentPath, "utf8")
  ]);

  const castles = JSON.parse(castlesRaw);
  const content = JSON.parse(contentRaw);
  const castlesById = new Map(castles.map((castle) => [castle.id, castle]));

  for (const id of TARGET_IDS) {
    if (!CONTENT_METADATA[id]) {
      throw new Error(`Missing Traditional Chinese metadata for id ${id}`);
    }
    if (!castlesById.has(id)) {
      throw new Error(`Missing castle source data for id ${id}`);
    }
  }

  const addedCount = TARGET_IDS.filter((id) => !(String(id) in content)).length;

  for (const id of TARGET_IDS) {
    const castle = castlesById.get(id);
    const metadata = CONTENT_METADATA[id];
    content[String(id)] = buildEntry(castle, metadata);
  }

  const serialized = `${JSON.stringify(content, null, 2)}\n`;
  await fs.writeFile(contentPath, serialized, "utf8");

  const parsedAfterWrite = JSON.parse(await fs.readFile(contentPath, "utf8"));
  const totalKeys = Object.keys(parsedAfterWrite).length;
  const missingInOneToTwoHundred = [];
  for (let id = 1; id <= 200; id += 1) {
    if (!(String(id) in parsedAfterWrite)) {
      missingInOneToTwoHundred.push(id);
    }
  }

  console.log(`Added entries: ${addedCount}`);
  console.log(`Validation: OK (JSON parse success)`);
  console.log(`Total keys: ${totalKeys}`);
  console.log(
    `Missing ids in 1-200: ${
      missingInOneToTwoHundred.length > 0
        ? missingInOneToTwoHundred.join(", ")
        : "none"
    }`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
