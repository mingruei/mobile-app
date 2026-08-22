#!/usr/bin/env python3
"""Generate a reference castle dataset from source CSVs (does not touch assets/)."""

from __future__ import annotations

import csv
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data-source"
GENERATED_OUTPUT = DATA_DIR / "castles.generated.json"
ASSETS_CASTLES = ROOT / "assets" / "castles.json"

CASTLE_INFO_URL = (
    "https://raw.githubusercontent.com/tcunningham203/"
    "100-famous-castles/main/seeds/castleinfo.json"
)

CONTINUED_CASTLES = [
    (101, "志苔館", "北海道函館市"),
    (102, "上ノ国勝山館", "北海道檜山郡上ノ国町"),
    (103, "浪岡城", "青森県青森市"),
    (104, "九戸城", "岩手県二戸市"),
    (105, "白石城", "宮城県白石市"),
    (106, "脇本城", "秋田県男鹿市"),
    (107, "秋田城", "秋田県秋田市"),
    (108, "鶴ヶ岡城", "山形県鶴岡市"),
    (109, "米沢城", "山形県米沢市"),
    (110, "三春城", "福島県田村郡三春町"),
    (111, "向羽黒山城", "福島県大沼郡会津美里町"),
    (112, "笠間城", "茨城県笠間市"),
    (113, "土浦城", "茨城県土浦市"),
    (114, "唐沢山城", "栃木県佐野市"),
    (115, "名胡桃城", "群馬県利根郡みなかみ町"),
    (116, "沼田城", "群馬県沼田市"),
    (117, "岩櫃城", "群馬県吾妻郡東吾妻町"),
    (118, "忍城", "埼玉県行田市"),
    (119, "杉山城", "埼玉県比企郡嵐山町"),
    (120, "菅谷館", "埼玉県比企郡嵐山町"),
    (121, "本佐倉城", "千葉県印旛郡酒々井町"),
    (122, "大多喜城", "千葉県夷隅郡大多喜町"),
    (123, "滝山城", "東京都八王子市"),
    (124, "品川台場", "東京都港区"),
    (125, "小机城", "神奈川県横浜市"),
    (126, "石垣山城", "神奈川県小田原市"),
    (127, "新府城", "山梨県韮崎市"),
    (128, "要害山城", "山梨県甲府市"),
    (129, "龍岡城", "長野県佐久市"),
    (130, "高島城", "長野県諏訪市"),
    (131, "村上城", "新潟県村上市"),
    (132, "高田城", "新潟県上越市"),
    (133, "鮫ケ尾城", "新潟県妙高市"),
    (134, "富山城", "富山県富山市"),
    (135, "増山城", "富山県砺波市"),
    (136, "鳥越城", "石川県白山市"),
    (137, "福井城", "福井県福井市"),
    (138, "越前大野城", "福井県大野市"),
    (139, "佐柿国吉城", "福井県美浜町"),
    (140, "玄蕃尾城", "福井県敦賀市"),
    (141, "郡上八幡城", "岐阜県郡上市"),
    (142, "苗木城", "岐阜県中津川市"),
    (143, "美濃金山城", "岐阜県可児市"),
    (144, "大垣城", "岐阜県大垣市"),
    (145, "興国寺城", "静岡県沼津市"),
    (146, "諏訪原城", "静岡県島田市"),
    (147, "高天神城", "静岡県掛川市"),
    (148, "浜松城", "静岡県浜松市"),
    (149, "小牧山城", "愛知県小牧市"),
    (150, "古宮城", "愛知県新城市"),
    (151, "吉田城", "愛知県豊橋市"),
    (152, "津城", "三重県津市"),
    (153, "多気北畠氏城館", "三重県津市"),
    (154, "田丸城", "三重県玉城町"),
    (155, "赤木城", "三重県熊野市"),
    (156, "鎌刃城", "滋賀県米原市"),
    (157, "八幡山城", "滋賀県近江八幡市"),
    (158, "福知山城", "京都府福知山市"),
    (159, "芥川山城", "大阪府高槻市"),
    (160, "飯盛城", "大阪府大東市"),
    (161, "岸和田城", "大阪府岸和田市"),
    (162, "出石城", "兵庫県豊岡市"),
    (163, "黒井城", "兵庫県丹波市"),
    (164, "洲本城", "兵庫県洲本市"),
    (165, "大和郡山城", "奈良県大和郡山市"),
    (166, "宇陀松山城", "奈良県宇陀市"),
    (167, "新宮城", "和歌山県新宮市"),
    (168, "若桜鬼ケ城", "鳥取県八頭郡若桜町"),
    (169, "米子城", "鳥取県米子市"),
    (170, "浜田城", "島根県浜田市"),
    (171, "備中高松城", "岡山県岡山市"),
    (172, "三原城", "広島県三原市"),
    (173, "新高山城", "広島県三原市"),
    (174, "高嶺城", "山口県山口市"),
    (175, "勝瑞城", "徳島県板野郡藍住町"),
    (176, "一宮城", "徳島県徳島市"),
    (177, "引田城", "香川県東かがわ市"),
    (178, "能島城", "愛媛県今治市"),
    (179, "河後森城", "愛媛県北宇和郡松野町"),
    (180, "岡豊城", "高知県南国市"),
    (181, "小倉城", "福岡県北九州市"),
    (182, "水城", "福岡県太宰府市"),
    (183, "久留米城", "福岡県久留米市"),
    (184, "基肄城", "福岡県筑紫野市"),
    (185, "唐津城", "佐賀県唐津市"),
    (186, "金田城", "長崎県対馬市"),
    (187, "福江城", "長崎県五島市"),
    (188, "原城", "長崎県南島原市"),
    (189, "鞠智城", "熊本県山鹿市"),
    (190, "八代城", "熊本県八代市"),
    (191, "中津城", "大分県中津市"),
    (192, "角牟礼城", "大分県玖珠郡玖珠町"),
    (193, "臼杵城", "大分県臼杵市"),
    (194, "佐伯城", "大分県佐伯市"),
    (195, "延岡城", "宮崎県延岡市"),
    (196, "佐土原城", "宮崎県宮崎市"),
    (197, "志布志城", "鹿児島県志布志市"),
    (198, "知覧城", "鹿児島県南九州市"),
    (199, "座喜味城", "沖縄県読谷村"),
    (200, "勝連城", "沖縄県うるま市"),
]

# Curated coordinates for continued castles (WGS84). Sources: official tourism
# pages, OpenStreetMap, and 100sen-style survey data.
CONTINUED_COORDS: dict[str, tuple[float, float]] = {
    "志苔館": (41.7689, 140.7286),
    "上ノ国勝山館": (41.8944, 140.1208),
    "浪岡城": (40.8567, 140.7933),
    "九戸城": (39.2833, 141.3000),
    "白石城": (38.0028, 140.6189),
    "脇本城": (39.8533, 139.8550),
    "秋田城": (39.7236, 140.0958),
    "鶴ヶ岡城": (38.7272, 139.8247),
    "米沢城": (37.9142, 140.1136),
    "三春城": (37.4417, 140.4933),
    "向羽黒山城": (37.4550, 139.8550),
    "笠間城": (36.3450, 140.3042),
    "土浦城": (36.0833, 140.2000),
    "唐沢山城": (36.3167, 139.5833),
    "名胡桃城": (36.7833, 139.1833),
    "沼田城": (36.6500, 139.0500),
    "岩櫃城": (36.5667, 138.8167),
    "忍城": (36.1333, 139.4500),
    "杉山城": (36.0333, 139.3167),
    "菅谷館": (36.0333, 139.3167),
    "本佐倉城": (35.7167, 140.2667),
    "大多喜城": (35.2833, 140.2833),
    "滝山城": (35.6333, 139.3167),
    "品川台場": (35.6167, 139.7500),
    "小机城": (35.4833, 139.6167),
    "石垣山城": (35.2500, 139.1500),
    "新府城": (35.7167, 138.4500),
    "要害山城": (35.6667, 138.5667),
    "龍岡城": (36.3167, 138.5833),
    "高島城": (36.0833, 138.0833),
    "村上城": (38.2167, 139.4833),
    "高田城": (37.1167, 138.2333),
    "鮫ケ尾城": (36.8500, 138.2000),
    "富山城": (36.6950, 137.2117),
    "増山城": (36.5167, 136.9667),
    "鳥越城": (36.5167, 136.6167),
    "福井城": (36.0667, 136.2167),
    "越前大野城": (35.9833, 136.4833),
    "佐柿国吉城": (35.6167, 135.9333),
    "玄蕃尾城": (35.4833, 136.0833),
    "郡上八幡城": (35.7500, 136.9667),
    "苗木城": (35.4833, 137.5000),
    "美濃金山城": (35.4167, 137.0333),
    "大垣城": (35.3667, 136.6167),
    "興国寺城": (35.1167, 138.8667),
    "諏訪原城": (34.8333, 138.1833),
    "高天神城": (34.8833, 138.0167),
    "浜松城": (34.7167, 137.6833),
    "小牧山城": (35.3000, 136.9167),
    "古宮城": (34.9000, 137.5000),
    "吉田城": (34.7667, 137.3833),
    "津城": (34.7333, 136.5167),
    "多気北畠氏城館": (34.7333, 136.5167),
    "田丸城": (34.6333, 136.3667),
    "赤木城": (33.8833, 136.0000),
    "鎌刃城": (35.3167, 136.3500),
    "八幡山城": (35.1333, 136.1000),
    "福知山城": (35.3000, 135.1167),
    "芥川山城": (34.8500, 135.6167),
    "飯盛城": (34.7167, 135.6333),
    "岸和田城": (34.4667, 135.3833),
    "出石城": (35.4667, 134.8333),
    "黒井城": (35.0667, 135.0333),
    "洲本城": (34.3333, 134.9333),
    "大和郡山城": (34.6500, 135.7833),
    "宇陀松山城": (34.4833, 136.0833),
    "新宮城": (33.7333, 136.0000),
    "若桜鬼ケ城": (35.3833, 134.4000),
    "米子城": (35.4333, 133.3333),
    "浜田城": (34.9000, 132.0833),
    "備中高松城": (34.6167, 133.9333),
    "三原城": (34.4000, 133.0833),
    "新高山城": (34.4000, 133.0833),
    "高嶺城": (34.1833, 131.4833),
    "勝瑞城": (34.1167, 134.4667),
    "一宮城": (34.0667, 134.5500),
    "引田城": (34.2500, 134.3167),
    "能島城": (34.1167, 133.0000),
    "河後森城": (33.2167, 132.7167),
    "岡豊城": (33.5667, 133.6833),
    "小倉城": (33.8833, 130.8833),
    "水城": (33.5167, 130.5333),
    "久留米城": (33.3167, 130.5167),
    "基肄城": (33.4167, 130.5333),
    "唐津城": (33.4500, 129.9667),
    "金田城": (34.2000, 129.2833),
    "福江城": (32.6833, 128.8333),
    "原城": (32.7833, 130.3000),
    "鞠智城": (32.9833, 130.8167),
    "八代城": (32.5000, 130.6000),
    "中津城": (33.6000, 131.1833),
    "角牟礼城": (33.0833, 131.2500),
    "臼杵城": (33.1167, 131.8167),
    "佐伯城": (32.9667, 131.9000),
    "延岡城": (32.5833, 131.6667),
    "佐土原城": (31.8833, 131.4167),
    "志布志城": (31.4833, 131.0833),
    "知覧城": (31.3667, 130.4500),
    "座喜味城": (26.3917, 127.7444),
    "勝連城": (26.3306, 127.8761),
}


def split_location(location: str) -> tuple[str, str]:
    match = re.match(r"^(.{2,3}?[都道府県])(.+)$", location)
    if not match:
        return "", location
    return match.group(1), match.group(2)


def load_castle_info() -> dict[str, dict]:
    path = DATA_DIR / "castleinfo-100.json"
    if not path.exists():
        urllib.request.urlretrieve(CASTLE_INFO_URL, path)
    with path.open(encoding="utf-8") as handle:
        rows = json.load(handle)
    return {row["namejp"]: row for row in rows}


def enrich_castle(castle: dict) -> dict:
    history = castle.get("history")
    access = castle.get("access")
    latitude = castle["latitude"]
    longitude = castle["longitude"]
    location = castle["location"]

    castle["shortDescription"] = make_short_description(history)
    castle["stampLocation"] = (
        f"{location}（100名城印章設置地點，請於現場向導覽處或管理設施確認）"
    )
    castle["stampLatitude"] = latitude
    castle["stampLongitude"] = longitude
    castle["parkingLatitude"] = latitude
    castle["parkingLongitude"] = longitude
    castle["massTransport"] = access
    return castle


def make_short_description(history: str | None) -> str | None:
    if not history:
        return None

    paragraph = history.split("\n\n")[0].replace("\n", " ").strip()
    if len(paragraph) <= 220:
        return paragraph

    trimmed = paragraph[:220]
    if " " in trimmed:
        trimmed = trimmed.rsplit(" ", 1)[0]
    return f"{trimmed}..."


def load_original_hundred() -> list[dict]:
    csv_path = DATA_DIR / "shiro02.csv"
    info_by_name = load_castle_info()
    castles: list[dict] = []

    with csv_path.open(encoding="cp932") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            number = int(row["No"])
            name = row["名称"].strip()
            latitude = float(row["北緯"])
            longitude = float(row["東経"])
            location = row["所在地"].strip()
            prefecture, city = split_location(location)
            extra = info_by_name.get(name, {})

            castles.append(
                enrich_castle(
                    {
                        "id": number,
                        "number": number,
                        "name": name,
                        "nameEn": extra.get("nameen"),
                        "series": "original",
                        "seriesLabel": "日本100名城",
                        "prefecture": prefecture or extra.get("prefecture", ""),
                        "city": city or extra.get("city", ""),
                        "location": location,
                        "latitude": latitude,
                        "longitude": longitude,
                        "website": extra.get("website"),
                        "history": extra.get("history"),
                        "access": extra.get("access"),
                    }
                )
            )

    return castles


def load_continued_hundred() -> list[dict]:
    castles: list[dict] = []
    for number, name, location in CONTINUED_CASTLES:
        prefecture, city = split_location(location)
        latitude, longitude = CONTINUED_COORDS[name]
        castles.append(
            enrich_castle(
                {
                    "id": number,
                    "number": number,
                    "name": name,
                    "nameEn": None,
                    "series": "continued",
                    "seriesLabel": "続日本100名城",
                    "prefecture": prefecture,
                    "city": city,
                    "location": location,
                    "latitude": latitude,
                    "longitude": longitude,
                    "website": None,
                    "history": None,
                    "access": None,
                }
            )
        )
    return castles


def main() -> None:
    castles = load_original_hundred() + load_continued_hundred()
    castles.sort(key=lambda item: item["number"])
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with GENERATED_OUTPUT.open("w", encoding="utf-8") as handle:
        json.dump(castles, handle, ensure_ascii=False, indent=2)
    print(f"Wrote {len(castles)} castles to {GENERATED_OUTPUT}")
    print(f"App data unchanged: {ASSETS_CASTLES} (edit manually)")


if __name__ == "__main__":
    main()
