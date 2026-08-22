#!/usr/bin/env python3
"""Build castle-card-sales.json from official jokaku.jp PDF listings."""

from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "data-source" / "castle-card-sales.json"

SOURCES = {
    "original": "https://jokaku.jp/wp-content/uploads/2026/07/6fc4dd08a8be88de3cd11b9da555cc65-1.pdf",
    "continued": "https://jokaku.jp/wp-content/uploads/2026/06/e201d17d81f33f8cf13beca7a9327f06.pdf",
}

# Curated from official PDF (2026-04 / 2026-06). Keys are castle numbers.
# Each location: googleLabel (JP), optional businessHours (zh-Hant), optional label (zh-Hant override)
CURATED: dict[str, dict[int, list[dict[str, str | None]]]] = {
    "original": {
        2: [
            {"googleLabel": "箱館奉行所", "businessHours": "請洽詢五稜郭公園管理事務所"},
            {"googleLabel": "お休処いたくら柳野", "label": "お休処 いたくら柳野"},
        ],
        3: [{"googleLabel": "松前観光案内所"}],
        4: [
            {"googleLabel": "弘前城天守内売店", "businessHours": "4月1日～11月23日"},
            {"googleLabel": "弘前城情報館", "businessHours": "全年"},
        ],
        7: [
            {"googleLabel": "多賀城ガイダンス施設"},
            {"googleLabel": "多賀城市観光案内所"},
        ],
        11: [{"googleLabel": "にほんまつ城報館", "label": "二本松城報館（霞城公園內）"}],
        12: [{"googleLabel": "鶴ヶ城観光案内所"}],
        13: [{"googleLabel": "二ノ丸茶屋売店", "label": "二之丸茶屋賣店"}],
        14: [
            {"googleLabel": "水戸観光コンベンション協会事務所"},
            {"googleLabel": "水戸観光案内所"},
            {"googleLabel": "弘道館", "label": "北澤賣店（弘道館內）"},
        ],
        23: [{"googleLabel": "小田原城天守閣", "label": "天守閣1樓博物館商店"}],
        27: [{"googleLabel": "上田市観光会館", "label": "上田市觀光會館賣店"}],
        28: [
            {"googleLabel": "小諸城址徴古館", "label": "小諸城址徴古館"},
            {"googleLabel": "懐古神社", "label": "懐古神社社務所"},
        ],
        29: [{"googleLabel": "松本城", "label": "松本城賣店（付費區內）"}],
        30: [{"googleLabel": "伊那市立高遠町歴史博物館"}],
        31: [
            {"googleLabel": "新発田城正門前安兵衛茶屋", "businessHours": "4月～11月"},
            {"googleLabel": "新発田市観光情報センター", "businessHours": "12月～3月"},
        ],
        33: [{"googleLabel": "高岡市立博物館", "label": "高岡市立博物館博物館商店"}],
        34: [{"googleLabel": "七尾城史資料館"}],
        36: [{"googleLabel": "丸岡城", "label": "丸岡城入場券售票處"}],
        37: [{"googleLabel": "一乗谷朝倉氏遺跡", "label": "復原町並南入場口"}],
        38: [{"googleLabel": "恵那市観光協会岩村支部", "label": "えなてらす、いわむら。"}],
        39: [
            {
                "googleLabel": "加藤栄三･東一記念美術館",
                "businessHours": "2025/10/23 起",
                "label": "加藤榮三・東一紀念美術館",
            }
        ],
        40: [{"googleLabel": "山中城", "label": "山中城賣店"}],
        41: [
            {
                "googleLabel": "駿府城公園東御門・巽櫓",
                "label": "駿府城公園東御門・巽櫓土產角落",
            }
        ],
        42: [{"googleLabel": "掛川城", "label": "掛川城御殿賣店"}],
        43: [{"googleLabel": "犬山城", "label": "犬山城郭內白帝觀光"}],
        44: [
            {"googleLabel": "名古屋城", "label": "正門旁賣店"},
            {"googleLabel": "名古屋城", "label": "內苑賣店"},
        ],
        45: [{"googleLabel": "岡崎城", "label": "岡崎城天守"}],
        48: [
            {"googleLabel": "松阪市立歴史民俗資料館"},
            {"googleLabel": "松阪駅", "label": "松阪站觀光資訊中心"},
            {"googleLabel": "豪商のまち松阪観光交流センター"},
        ],
        50: [{"googleLabel": "彦根城", "label": "開國紀念館"}],
        54: [{"googleLabel": "大阪城", "label": "天守閣1樓博物館商店"}],
        56: [{"googleLabel": "竹田城", "label": "情報館　天空之城"}],
        57: [{"googleLabel": "篠山城大書院", "label": "篠山城大書院博物館商店"}],
        58: [{"googleLabel": "明石公園", "label": "明石公園服務中心"}],
        59: [
            {"googleLabel": "姫路城", "label": "姫路城賣店（出改札旁）"},
            {"googleLabel": "姫路城", "label": "西之丸化妝櫓前賣店"},
        ],
        61: [{"googleLabel": "高取町観光案内所 夢創館"}],
        62: [{"googleLabel": "和歌山城", "label": "御天守茶屋"}],
        63: [
            {"googleLabel": "鳥取城跡 仁風閣", "label": "鳥取城跡・仁風閣展示館"},
            {"googleLabel": "鳥取市歴史博物館", "label": "鳥取市歷史博物館（やまびこ館）"},
            {"googleLabel": "鳥取市ふるさと物産館", "label": "鳥取市故鄉物產館（まちパル）"},
        ],
        64: [{"googleLabel": "松江城", "label": "ぶらっと松江觀光案內所"}],
        65: [{"googleLabel": "安来市立歴史資料館"}],
        66: [{"googleLabel": "津和野城跡観光リフト"}],
        67: [{"googleLabel": "津山城", "label": "備中櫓"}],
        68: [
            {"googleLabel": "備中松山城", "label": "備中松山城售票處"},
            {"googleLabel": "備中松山城", "label": "ふいご峠賣店（8合目）"},
            {"googleLabel": "備中松山城", "label": "備中松山城登城整理巴士乘車處"},
        ],
        70: [{"googleLabel": "岡山城", "label": "金烏城商店（天守閣內）"}],
        71: [{"googleLabel": "福山城博物館", "label": "福山城博物館內博物館商店"}],
        72: [{"googleLabel": "安芸高田市歴史民俗博物館"}],
        74: [
            {"googleLabel": "岩国城", "label": "岩國城入口受理櫃檯"},
            {"googleLabel": "岩国城ロープウェー", "label": "纜車山麓站受理（惡天時）"},
        ],
        76: [{"googleLabel": "徳島市立徳島城博物館", "label": "德島城博物館內博物館商店"}],
        77: [
            {"googleLabel": "玉藻公園", "label": "玉藻公園管理事務所・東料金所"},
            {"googleLabel": "玉藻公園", "label": "玉藻公園西料金所"},
        ],
        78: [{"googleLabel": "丸亀城", "label": "丸龜城天守"}],
        79: [{"googleLabel": "今治城", "label": "今治城天守賣店"}],
        80: [{"googleLabel": "湯築城資料館", "label": "湯築城資料館賣店"}],
        81: [
            {"googleLabel": "松山城", "label": "松山城觀光案內所"},
            {"googleLabel": "松山城", "label": "松山城售票處"},
        ],
        82: [{"googleLabel": "大洲城", "label": "大洲城受理旁商品角落"}],
        83: [{"googleLabel": "宇和島城", "label": "宇和島城天守受理"}],
        84: [{"googleLabel": "高知城", "label": "懷德館櫃檯"}],
        86: [
            {"googleLabel": "太宰府展示館", "label": "太宰府展示館（太宰府市）"},
            {
                "googleLabel": "心のふるさと館",
                "label": "心のふるさと館1樓 ここふるショップ（大野城市）",
            },
            {"googleLabel": "宇美町立歴史民俗資料館", "label": "宇美町立歴史民俗資料館（宇美町）"},
        ],
        87: [{"googleLabel": "佐賀県立名護屋城博物館"}],
        88: [{"googleLabel": "吉野ヶ里歴史公園", "label": "吉野ヶ里歷史公園東口賣店"}],
        89: [{"googleLabel": "佐賀城本丸歴史館"}],
        91: [{"googleLabel": "島原城", "label": "天守閣售票處"}],
        92: [
            {"googleLabel": "熊本城", "label": "本丸休憩處"},
            {"googleLabel": "熊本城", "label": "二之丸休憩處"},
        ],
        97: [
            {
                "googleLabel": "鹿児島県歴史資料センター黎明館",
                "label": "黎明館1樓 CHIN JUKAN POTTERY 喫茶室",
            },
            {"googleLabel": "鹿児島まち歩き観光ステーション", "label": "鹿児島まち歩き観光ステーション"},
        ],
        98: [{"googleLabel": "今帰仁城跡", "label": "今歸仁城跡售票處"}],
        99: [
            {"googleLabel": "中城城跡", "label": "中城城跡共同管理協議會管理事務所"},
            {"googleLabel": "GUSUKU ROCK CAFE"},
            {"googleLabel": "中城村観光協会", "label": "中城村觀光協會事務所"},
        ],
    },
    "continued": {
        104: [{"googleLabel": "二戸市埋蔵文化財センター"}],
        105: [{"googleLabel": "白石城歴史探訪ミュージアム", "label": "白石城歷史探訪博物館1樓賣店"}],
        107: [{"googleLabel": "秋田市立秋田城跡歴史資料館"}],
        109: [{"googleLabel": "米沢観光コンベンション協会", "label": "米澤觀光協會觀光案內所"}],
        112: [{"googleLabel": "かさま歴史交流館井筒屋", "label": "笠間歷史交流館井筒屋"}],
        113: [{"googleLabel": "土浦まちかど蔵大徳", "label": "土浦まちかど蔵「大徳」"}],
        118: [
            {"googleLabel": "行田市郷土博物館", "label": "行田市鄉土博物館博物館商店"},
            {"googleLabel": "観光物産ぷらっと♪ぎょうだ", "label": "觀光物產ぷらっと♪ぎょうだ"},
            {"googleLabel": "忍城", "label": "忍城巴士總站觀光案內所"},
        ],
        120: [{"googleLabel": "嵐山史跡の博物館", "label": "埼玉縣立嵐山史跡博物館受理"}],
        126: [{"googleLabel": "小田原城天守閣", "label": "小田原城天守閣賣店"}],
        131: [{"googleLabel": "村上市郷土資料ロビー", "label": "村上市郷土資料ロビー"}],
        135: [
            {"googleLabel": "道の駅砺波", "label": "道の駅砺波 となみ野の郷"},
            {"googleLabel": "砺波駅", "label": "砺波駅観光案内所"},
            {"googleLabel": "砺波市埋蔵文化財センター"},
            {"googleLabel": "せんだんのHILL"},
        ],
        138: [{"googleLabel": "越前大野城", "label": "越前おおの結楽座"}],
        139: [{"googleLabel": "若狭国吉城歴史資料館"}],
        141: [{"googleLabel": "郡上八幡城", "label": "郡上八幡城賣店"}],
        142: [{"googleLabel": "中津川市苗木遠山史料館"}],
        143: [{"googleLabel": "可児市山城ミュージアム", "label": "可児市山城博物館"}],
        144: [{"googleLabel": "大垣城", "label": "大垣城天守"}],
        149: [
            {"googleLabel": "小牧山城史跡情報館", "label": "小牧山城史跡情報館（れきしるこまき）"},
            {"googleLabel": "小牧山歴史館"},
        ],
        155: [
            {"googleLabel": "入鹿温泉ホテル瀞流荘"},
            {"googleLabel": "道の駅 熊野・板屋九郎兵衛の里"},
        ],
        160: [
            {"googleLabel": "大東市立歴史民俗資料館", "label": "飯盛城（大東市）"},
            {"googleLabel": "四條畷市 歴史民俗資料館", "label": "飯盛城（四條畷市）"},
        ],
        161: [
            {"googleLabel": "岸和田城", "label": "岸和田だんじり会館"},
            {"googleLabel": "二の丸広場観光交流センター"},
        ],
        162: [{"googleLabel": "いずし観光センター", "label": "出石觀光案內所"}],
        164: [{"googleLabel": "洲本市立淡路文化史料館"}],
        165: [
            {"googleLabel": "柳沢文庫", "label": "柳沢文庫窓口"},
            {
                "googleLabel": "大和郡山市観光協会",
                "label": "柳澤文庫前庭園內「番屋カフェ」",
            },
        ],
        166: [{"googleLabel": "宇陀市松山地区まちかどラボ"}],
        167: [{"googleLabel": "新宮市観光協会", "label": "新宮市觀光協會"}],
        168: [{"googleLabel": "若桜町観光協会", "label": "若桜町觀光協會"}],
        169: [
            {"googleLabel": "米子市立山陰歴史館"},
            {"googleLabel": "米子まちなか観光案内所"},
        ],
        172: [{"googleLabel": "三原観光協会"}],
        173: [{"googleLabel": "本郷生涯学習センター", "businessHours": "平日午前のみ", "label": "本郷町觀光協會"}],
        175: [{"googleLabel": "apollostation勝瑞SS", "label": "apollostation勝瑞SS（武田石油）"}],
        178: [{"googleLabel": "今治市村上海賊ミュージアム", "label": "JiBaカフェ能島（村上海賊博物館）"}],
        180: [{"googleLabel": "高知県立歴史民俗資料館", "label": "高知縣立歷史民俗資料館博物館商店"}],
        181: [{"googleLabel": "小倉城", "label": "しろテラス"}],
        182: [
            {"googleLabel": "太宰府展示館", "label": "太宰府展示館（太宰府市）"},
            {
                "googleLabel": "心のふるさと館",
                "label": "ここふるショップ（心のふるさと館1樓・大野城市）",
            },
        ],
        187: [{"googleLabel": "五島市観光協会", "label": "五島市觀光協會"}],
        194: [{"googleLabel": "佐伯市歴史資料館"}],
        199: [
            {
                "googleLabel": "世界遺産座喜味城跡",
                "label": "世界遺產座喜味城跡ユンタンザミュージアム",
            },
        ],
        200: [{"googleLabel": "勝連城", "businessHours": "調整中，販售時期未定", "label": "勝連城（調整中）"}],
    },
}


def normalize_hours(value: str | None) -> str | None:
    if not value:
        return None
    return (
        value.replace("通年", "全年")
        .replace("月曜", "週一")
        .replace("火曜", "週二")
        .replace("水曜", "週三")
        .replace("木曜", "週四")
        .replace("金曜", "週五")
        .replace("土曜", "週六")
        .replace("日曜", "週日")
        .strip()
    )


def main() -> int:
    payload = {
        "sources": SOURCES,
        "updated": "2026-07",
        "series": {},
    }

    for series, entries in CURATED.items():
        normalized: dict[str, list[dict[str, str | None]]] = {}
        for number, locations in sorted(entries.items()):
            normalized[str(number)] = [
                {
                    "googleLabel": loc["googleLabel"],
                    "label": loc.get("label") or loc["googleLabel"],
                    "businessHours": normalize_hours(loc.get("businessHours")),
                }
                for loc in locations
            ]
        payload["series"][series] = normalized

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}")
    print(
        "counts:",
        {series: len(entries) for series, entries in payload["series"].items()},
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
