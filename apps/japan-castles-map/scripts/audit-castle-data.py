#!/usr/bin/env python3
"""Audit and optionally fix castle data against Japan Castle Association references."""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CASTLES_PATH = ROOT / "assets" / "castles.json"
CONTENT_PATH = ROOT / "assets" / "i18n" / "castle-content.zh-Hant.json"
REPORT_PATH = ROOT / "docs" / "castle-audit-report.md"
SHIRO02_PATH = ROOT / "data-source" / "shiro02.csv"
CASTLEINFO_PATH = ROOT / "data-source" / "castleinfo-100.json"

# 公益財団法人日本城郭協会 — 続日本100名城 (jokaku.jp)
CONTINUED_OFFICIAL: dict[int, tuple[str, str]] = {
    101: ("志苔館", "北海道函館市"),
    102: ("上ノ国勝山館", "北海道檜山郡上ノ国町"),
    103: ("浪岡城", "青森県青森市"),
    104: ("九戸城", "岩手県二戸市"),
    105: ("白石城", "宮城県白石市"),
    106: ("脇本城", "秋田県男鹿市"),
    107: ("秋田城", "秋田県秋田市"),
    108: ("鶴ヶ岡城", "山形県鶴岡市"),
    109: ("米沢城", "山形県米沢市"),
    110: ("三春城", "福島県田村郡三春町"),
    111: ("向羽黒山城", "福島県大沼郡会津美里町"),
    112: ("笠間城", "茨城県笠間市"),
    113: ("土浦城", "茨城県土浦市"),
    114: ("唐沢山城", "栃木県佐野市"),
    115: ("名胡桃城", "群馬県利根郡みなかみ町"),
    116: ("沼田城", "群馬県沼田市"),
    117: ("岩櫃城", "群馬県吾妻郡東吾妻町"),
    118: ("忍城", "埼玉県行田市"),
    119: ("杉山城", "埼玉県比企郡嵐山町"),
    120: ("菅谷館", "埼玉県比企郡嵐山町"),
    121: ("本佐倉城", "千葉県印旛郡酒々井町"),
    122: ("大多喜城", "千葉県夷隅郡大多喜町"),
    123: ("滝山城", "東京都八王子市"),
    124: ("品川台場", "東京都港区"),
    125: ("小机城", "神奈川県横浜市"),
    126: ("石垣山城", "神奈川県小田原市"),
    127: ("新府城", "山梨県韮崎市"),
    128: ("要害山城", "山梨県甲府市"),
    129: ("龍岡城", "長野県佐久市"),
    130: ("高島城", "長野県諏訪市"),
    131: ("村上城", "新潟県村上市"),
    132: ("高田城", "新潟県上越市"),
    133: ("鮫ケ尾城", "新潟県妙高市"),
    134: ("富山城", "富山県富山市"),
    135: ("増山城", "富山県砺波市"),
    136: ("鳥越城", "石川県白山市"),
    137: ("福井城", "福井県福井市"),
    138: ("越前大野城", "福井県大野市"),
    139: ("佐柿国吉城", "福井県美浜町"),
    140: ("玄蕃尾城", "福井県敦賀市"),
    141: ("郡上八幡城", "岐阜県郡上市"),
    142: ("苗木城", "岐阜県中津川市"),
    143: ("美濃金山城", "岐阜県可児市"),
    144: ("大垣城", "岐阜県大垣市"),
    145: ("興国寺城", "静岡県沼津市"),
    146: ("諏訪原城", "静岡県島田市"),
    147: ("高天神城", "静岡県掛川市"),
    148: ("浜松城", "静岡県浜松市"),
    149: ("小牧山城", "愛知県小牧市"),
    150: ("古宮城", "愛知県新城市"),
    151: ("吉田城", "愛知県豊橋市"),
    152: ("津城", "三重県津市"),
    153: ("多気北畠氏城館", "三重県津市"),
    154: ("田丸城", "三重県玉城町"),
    155: ("赤木城", "三重県熊野市"),
    156: ("鎌刃城", "滋賀県米原市"),
    157: ("八幡山城", "滋賀県近江八幡市"),
    158: ("福知山城", "京都府福知山市"),
    159: ("芥川山城", "大阪府高槻市"),
    160: ("飯盛城", "大阪府大東市"),
    161: ("岸和田城", "大阪府岸和田市"),
    162: ("出石城・有子山城", "兵庫県豊岡市"),
    163: ("黒井城", "兵庫県丹波市"),
    164: ("洲本城", "兵庫県洲本市"),
    165: ("大和郡山城", "奈良県大和郡山市"),
    166: ("宇陀松山城", "奈良県宇陀市"),
    167: ("新宮城", "和歌山県新宮市"),
    168: ("若桜鬼ケ城", "鳥取県八頭郡若桜町"),
    169: ("米子城", "鳥取県米子市"),
    170: ("浜田城", "島根県浜田市"),
    171: ("備中高松城", "岡山県岡山市"),
    172: ("三原城", "広島県三原市"),
    173: ("新高山城", "広島県三原市"),
    174: ("大内氏館・高嶺城", "山口県山口市"),
    175: ("勝瑞城", "徳島県板野郡藍住町"),
    176: ("一宮城", "徳島県徳島市"),
    177: ("引田城", "香川県東かがわ市"),
    178: ("能島城", "愛媛県今治市"),
    179: ("河後森城", "愛媛県北宇和郡松野町"),
    180: ("岡豊城", "高知県南国市"),
    181: ("小倉城", "福岡県北九州市"),
    182: ("水城", "福岡県太宰府市"),
    183: ("久留米城", "福岡県久留米市"),
    184: ("基肄城", "福岡県筑紫野市"),
    185: ("唐津城", "佐賀県唐津市"),
    186: ("金田城", "長崎県対馬市"),
    187: ("福江城", "長崎県五島市"),
    188: ("原城", "長崎県南島原市"),
    189: ("鞠智城", "熊本県山鹿市"),
    190: ("八代城", "熊本県八代市"),
    191: ("中津城", "大分県中津市"),
    192: ("角牟礼城", "大分県玖珠郡玖珠町"),
    193: ("臼杵城", "大分県臼杵市"),
    194: ("佐伯城", "大分県佐伯市"),
    195: ("延岡城", "宮崎県延岡市"),
    196: ("佐土原城", "宮崎県宮崎市"),
    197: ("志布志城", "鹿児島県志布志市"),
    198: ("知覧城", "鹿児島県南九州市"),
    199: ("座喜味城", "沖縄県読谷村"),
    200: ("勝連城", "沖縄県うるま市"),
}

# 日本100名城 — overrides where shiro02 differs from jokaku official name
ORIGINAL_NAME_OVERRIDES: dict[int, str] = {
    15: "足利氏館",
    16: "箕輪城",
    17: "金山城",
    24: "武田氏館",
    54: "大阪城",
    72: "郡山城",
    88: "吉野ヶ里",
    94: "大分府内城",
    97: "鹿児島城(黎明館)",
}

# Subtitle (繁中顯示) overrides — keep readable Traditional Chinese
SUBTITLE_OVERRIDES: dict[int, str] = {
    16: "箕輪城",
    17: "金山城",
    54: "大阪城",
    72: "郡山城",
    88: "吉野ヶ里",
    133: "鮫ケ尾城",
    168: "若桜鬼ケ城",
    174: "大內氏館‧高嶺城",
}

NAME_FIXES: dict[int, str] = {
    16: "箕輪城",
    17: "金山城",
    54: "大阪城",
    72: "郡山城",
    88: "吉野ヶ里",
    133: "鮫ケ尾城",
    168: "若桜鬼ケ城",
    174: "大内氏館・高嶺城",
}


def normalize_name(name: str) -> str:
    return re.sub(r"（.*?）", "", name).strip()


def load_original_official() -> dict[int, tuple[str, str, float, float]]:
    refs: dict[int, tuple[str, str, float, float]] = {}
    with SHIRO02_PATH.open(encoding="cp932") as handle:
        reader = csv.reader(handle)
        next(reader, None)
        for row in reader:
            if not row or row[0] == "No":
                continue
            number = int(row[0])
            name = ORIGINAL_NAME_OVERRIDES.get(number, normalize_name(row[1]))
            location = row[4].strip()
            refs[number] = (name, location, float(row[2]), float(row[3]))
    return refs


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def get_coord(castle: dict, kind: str) -> tuple[float | None, float | None]:
    if kind == "main":
        return castle.get("latitude"), castle.get("longitude")
    if kind == "stamp":
        lat = castle.get("latitude_stamp") or castle.get("stampLatitude")
        lng = castle.get("longitude_stamp") or castle.get("stampLongitude")
        return lat, lng
    lat = castle.get("latitude_parking") or castle.get("parkingLatitude")
    lng = castle.get("longitude_parking") or castle.get("parkingLongitude")
    return lat, lng


def audit(fix: bool = False) -> dict:
    castles: list[dict] = json.loads(CASTLES_PATH.read_text(encoding="utf-8"))
    content: dict = json.loads(CONTENT_PATH.read_text(encoding="utf-8"))
    original_refs = load_original_official()
    castleinfo = {
        int(item["stampnumber"]): item for item in json.loads(CASTLEINFO_PATH.read_text(encoding="utf-8"))
    }

    findings = {
        "json_ok": True,
        "name_mismatches": [],
        "location_flags": [],
        "coord_flags": [],
        "website_flags": [],
        "content_missing": [],
        "content_subtitle_flags": [],
        "content_coord_flags": [],
        "id_flags": [],
        "fixes_applied": [],
    }

    ids = [c["id"] for c in castles]
    if len(ids) != len(set(ids)):
        findings["id_flags"].append(f"duplicate ids: {[i for i in ids if ids.count(i) > 1]}")
    missing_ids = [i for i in range(1, 201) if i not in ids]
    if missing_ids:
        findings["id_flags"].append(f"missing ids: {missing_ids}")

    content_ids = {int(k) for k in content.keys()}
    for castle in castles:
        n = castle["number"]
        cid = castle["id"]

        if n <= 100:
            ref = original_refs.get(n)
            if not ref:
                continue
            off_name, off_loc, ref_lat, ref_lng = ref
        else:
            cont = CONTINUED_OFFICIAL.get(n)
            if not cont:
                continue
            off_name, off_loc = cont
            ref_lat = ref_lng = None

        if castle["name"] != off_name:
            findings["name_mismatches"].append(
                {"number": n, "official": off_name, "current": castle["name"]}
            )
            if fix and n in NAME_FIXES:
                castle["name"] = NAME_FIXES[n]
                findings["fixes_applied"].append(f"#{n} name → {NAME_FIXES[n]}")

        pref = castle.get("prefecture", "")
        if pref and pref not in off_loc and n != 184:
            findings["location_flags"].append(
                {"number": n, "official": off_loc, "prefecture": pref, "location": castle.get("location")}
            )

        if ref_lat is not None:
            lat, lng = get_coord(castle, "main")
            if lat is None or lng is None:
                findings["coord_flags"].append({"number": n, "issue": "missing main coordinates"})
            elif haversine_km(lat, lng, ref_lat, ref_lng) > 15:
                findings["coord_flags"].append(
                    {
                        "number": n,
                        "issue": "main coord far from shiro02",
                        "current": (lat, lng),
                        "reference": (ref_lat, ref_lng),
                        "km": round(haversine_km(lat, lng, ref_lat, ref_lng), 1),
                    }
                )
                if fix:
                    castle["latitude"] = ref_lat
                    castle["longitude"] = ref_lng
                    findings["fixes_applied"].append(f"#{n} main coords → shiro02")

        info = castleinfo.get(n) if n <= 100 else None
        website = castle.get("website")
        if info and website and info.get("website"):
            a = website.rstrip("/").lower()
            b = info["website"].rstrip("/").lower()
            if a != b and "http" in a:
                findings["website_flags"].append(
                    {"number": n, "current": website, "castleinfo": info["website"]}
                )

        key = str(cid)
        if key not in content:
            findings["content_missing"].append(n)
            continue

        entry = content[key]
        expected_sub = SUBTITLE_OVERRIDES.get(n, off_name)
        subtitle = entry.get("subtitle") or ""
        if subtitle and expected_sub not in subtitle and subtitle not in off_name:
            if normalize_name(subtitle) != normalize_name(off_name):
                findings["content_subtitle_flags"].append(
                    {"number": n, "official": expected_sub, "subtitle": subtitle}
                )
        if fix and n in SUBTITLE_OVERRIDES:
            entry["subtitle"] = SUBTITLE_OVERRIDES[n]
            findings["fixes_applied"].append(f"#{n} subtitle → {SUBTITLE_OVERRIDES[n]}")

        for label, kind in (("stamp", "stamp"), ("parking", "parking")):
            lat, lng = get_coord(castle, kind)
            if lat is None or lng is None:
                continue
            points = []
            if kind == "stamp":
                points = entry.get("stampLocations") or []
            else:
                points = (entry.get("driving") or {}).get("parkingLocations") or []
            for point in points:
                plat, plng = point.get("latitude"), point.get("longitude")
                if plat is None or plng is None:
                    continue
                km = haversine_km(lat, lng, plat, plng)
                if km > 25:
                    findings["content_coord_flags"].append(
                        {
                            "number": n,
                            "kind": kind,
                            "castle": (lat, lng),
                            "content": (plat, plng),
                            "km": round(km, 1),
                            "label": point.get("label"),
                        }
                    )

    if fix:
        CASTLES_PATH.write_text(json.dumps(castles, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        CONTENT_PATH.write_text(json.dumps(content, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    return findings


def write_report(findings: dict) -> None:
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# 名城資料校正報告",
        "",
        "對照來源：公益財団法人日本城郭協会（日本100名城・続日本100名城）、",
        "`data-source/shiro02.csv`（百名城座標）、`castleinfo-100.json`（官網參考）。",
        "",
        "## 摘要",
        "",
        f"- JSON 格式：{'正常' if findings['json_ok'] else '異常'}",
        f"- 編號/城名不一致：{len(findings['name_mismatches'])} 筆",
        f"- 所在地疑慮：{len(findings['location_flags'])} 筆",
        f"- 主座標疑慮（距 shiro02 >15km）：{len(findings['coord_flags'])} 筆",
        f"- 官網與 castleinfo 不同：{len(findings['website_flags'])} 筆（多為更新後 tourism URL，未必錯誤）",
        f"- content 缺漏：{len(findings['content_missing'])} 筆",
        f"- content subtitle 疑慮：{len(findings['content_subtitle_flags'])} 筆",
        f"- content 座標距 castles.json >25km：{len(findings['content_coord_flags'])} 筆",
        "",
    ]
    if findings["fixes_applied"]:
        lines += ["## 已自動修正", ""]
        for item in findings["fixes_applied"]:
            lines.append(f"- {item}")
        lines.append("")

    def section(title: str, items: list, formatter) -> None:
        if not items:
            return
        lines.append(f"## {title}")
        lines.append("")
        for item in items:
            lines.append(formatter(item))
        lines.append("")

    section(
        "編號/城名不一致（日本城郭協会）",
        findings["name_mismatches"],
        lambda x: f"- **#{x['number']}** 協会「{x['official']}」／目前「{x['current']}」",
    )
    section(
        "所在地疑慮",
        findings["location_flags"],
        lambda x: f"- **#{x['number']}** 協会「{x['official']}」／prefecture「{x['prefecture']}」",
    )
    section(
        "主座標疑慮",
        findings["coord_flags"],
        lambda x: f"- **#{x['number']}** {x.get('issue', '')} {x.get('km', '')}",
    )
    section(
        "官網與 castleinfo 不同（僅參考）",
        findings["website_flags"][:30],
        lambda x: f"- **#{x['number']}** 目前 {x['current']}",
    )
    if len(findings["website_flags"]) > 30:
        lines.append(f"- …另有 {len(findings['website_flags']) - 30} 筆")
        lines.append("")

    section(
        "content subtitle 疑慮",
        findings["content_subtitle_flags"],
        lambda x: f"- **#{x['number']}** 協会「{x['official']}」／subtitle「{x['subtitle']}」",
    )
    section(
        "content 座標距離疑慮",
        findings["content_coord_flags"],
        lambda x: f"- **#{x['number']}** {x['kind']} 相距 {x['km']}km（{x.get('label', '')}）",
    )

    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fix", action="store_true", help="Apply safe automatic fixes")
    args = parser.parse_args()
    findings = audit(fix=args.fix)
    write_report(findings)
    print(json.dumps({k: len(v) if isinstance(v, list) else v for k, v in findings.items()}, ensure_ascii=False, indent=2))
    print(f"Report: {REPORT_PATH}")


if __name__ == "__main__":
    main()
