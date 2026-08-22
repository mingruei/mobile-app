#!/usr/bin/env python3
"""Fetch stamp hours for 100名城 and 續100名城, merge into castle-content."""

from __future__ import annotations

import json
import re
import sys
import urllib.request
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CASTLES_PATH = ROOT / "assets" / "castles.json"
CONTENT_PATH = ROOT / "assets" / "i18n" / "castle-content.zh-Hant.json"
OVERRIDES_PATH = ROOT / "data-source" / "stamp-hours-overrides.json"

STAMP_MARKER = (
    r"◆\s*(?:続(?:日本)?100名城|日本100名城)スタンプ設置場(?:所|)"
)
HOURS_PREFIX = (
    r"(?:開館時間|営業時間|設置時間|開設時間|入園時間|開城時間|開門時間|開館日|時間)"
)

SERIES_CONFIG = {
    "original": {
        "sourceUrl": "https://plus-castle.com/meijou/",
        "headerPattern": r'<p class="wp-block-paragraph"><strong>NO\d+\.\s*([^<]+)</strong>',
    },
    "continued": {
        "sourceUrl": "https://plus-castle.com/zokumeijou/",
        "headerPattern": r'<p class="wp-block-paragraph"><strong>(\d+)\.([^<]+)</strong>',
    },
}

PAGE_NAME_ALIASES = {
    "松坂城": "松阪城",
    "大坂城": "大阪城",
    "松坂城跡": "松阪城",
}


def norm(text: str) -> str:
    return re.sub(
        r"[\s　・（）()「」『』\[\]【】※\-－—–~～:：;；,，.．/／\\]",
        "",
        text,
    )


def match_score(google_label: str, source_name: str) -> int:
    n1, n2 = norm(google_label), norm(source_name)
    if not n1 or not n2:
        return 0
    if n1 in n2 or n2 in n1:
        return 100

    prefix = 0
    for a, b in zip(n1, n2):
        if a != b:
            break
        prefix += 1
    prefix_score = min(prefix * 4, 80)

    tokens1 = set(re.findall(r"[\u4e00-\u9fff\u30a0-\u30ff]{2,}", google_label))
    tokens2 = set(re.findall(r"[\u4e00-\u9fff\u30a0-\u30ff]{2,}", source_name))
    overlap = len(tokens1 & tokens2) * 20

    return max(prefix_score, overlap)


def ja_hours_to_zh(text: str) -> str:
    if not text:
        return ""
    text = (
        text.replace("営業時間", "營業時間")
        .replace("開館時間", "開館時間")
        .replace("開館：", "開館時間：")
        .replace("開設時間", "開設時間")
        .replace("設置時間", "設置時間")
        .replace("入園時間", "入園時間")
        .replace("開城時間", "開城時間")
        .replace("開門時間", "開門時間")
        .replace("開館日", "開館日")
        .replace("時間：", "時間：")
        .replace("休館日", "休館日")
        .replace("休業日", "休業日")
        .replace("定休日", "定休日")
        .replace("押印可", "可蓋章")
        .replace("終日押印可", "全日可蓋章")
        .replace("終日押印課可能", "全日可蓋章")
        .replace("の冬季休館中", "冬季休館期間")
        .replace("年中無休", "全年無休")
        .replace("営業時間制限なし", "無營業時間限制")
    )
    day_map = {
        "月曜日": "週一",
        "火曜日": "週二",
        "水曜日": "週三",
        "木曜日": "週四",
        "金曜日": "週五",
        "土曜日": "週六",
        "日曜日": "週日",
        "祝日": "國定假日",
        "月曜休館": "週一休館",
        "火曜休館": "週二休館",
        "水曜休館": "週三休館",
        "木曜休館": "週四休館",
        "金曜休館": "週五休館",
        "月曜休日": "週一休館",
        "火曜定休": "週二休館",
        "水曜定休": "週三休館",
        "木曜休館": "週四休館",
        "土日祝": "週六日及國定假日",
        "土日祝も": "週六日及國定假日亦",
    }
    for ja, zh in day_map.items():
        text = text.replace(ja, zh)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def fetch_source_html(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "japan-castles-map-data-sync/1.0"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", errors="ignore")


def parse_location_segment(segment: str) -> dict[str, str]:
    segment = segment.lstrip("・").strip()
    if not segment:
        return {"name": "", "hours": ""}

    hours_match = re.search(
        rf"(.+?)({HOURS_PREFIX}[：:~〜\-]?\s*.+)$",
        segment,
    )
    if hours_match:
        return {
            "name": hours_match.group(1).strip(),
            "hours": hours_match.group(2).strip(),
        }

    if any(
        keyword in segment
        for keyword in ("終日", "24時間", "常時", "年中無休", "押印", "時間可")
    ):
        if re.search(r"24\s*時間", segment):
            name = re.sub(r"※.*", "", segment).strip()
            return {"name": name, "hours": "24 小時可蓋章"}
        name = re.sub(r"※.*", "", segment).strip()
        note = segment[len(name) :].strip()
        return {"name": name, "hours": note}

    return {"name": segment, "hours": ""}


def parse_stamp_block(raw: str) -> list[dict[str, str]]:
    raw = unescape(raw)
    raw = re.sub(STAMP_MARKER, "", raw, count=1)
    raw = raw.replace("\n", "")
    raw = re.sub(r"^(?:<br>\s*)+", "", raw, flags=re.I)
    lines = [line.strip() for line in raw.split("<br>") if line.strip() and line.strip().lower() != "<br>"]

    locations: list[dict[str, str]] = []
    if len(lines) <= 1 and "・" in raw:
        for segment in re.split(r"(?=・)", raw):
            parsed = parse_location_segment(segment)
            if parsed["name"]:
                locations.append(parsed)
        return locations

    current_name: str | None = None
    current_hours: list[str] = []
    for line in lines:
        line = re.sub(r"^　+", "", line)
        if line.startswith("・"):
            if current_name:
                locations.append(
                    {
                        "name": current_name,
                        "hours": " ".join(current_hours).strip(),
                    }
                )
            remainder = line[1:].strip()
            inline = parse_location_segment(f"・{remainder}")
            if inline["hours"]:
                locations.append(inline)
                current_name = None
                current_hours = []
            else:
                current_name = inline["name"]
                current_hours = []
        else:
            current_hours.append(line)

    if current_name:
        locations.append(
            {
                "name": current_name,
                "hours": " ".join(current_hours).strip(),
            }
        )

    return locations


def parse_stamp_sections(html: str, header_pattern: str) -> list[dict]:
    parts = re.split(header_pattern, html)
    sections: list[dict] = []
    step = 2 if "NO" in header_pattern else 3

    for index in range(1, len(parts), step):
        if step == 3:
            page_name = parts[index + 1].strip().replace("&nbsp;", "").strip()
            chunk = parts[index + 2]
        else:
            page_name = parts[index].strip()
            chunk = parts[index + 1]

        match = re.search(
            rf"({STAMP_MARKER}<br>.*?)</p>",
            chunk,
            re.S,
        )
        if not match:
            match = re.search(
                rf"({STAMP_MARKER}[^<]*)</p>",
                chunk,
                re.S,
            )

        locations: list[dict[str, str]] = []
        if match:
            locations = parse_stamp_block(match.group(1))

        sections.append({"pageName": page_name, "locations": locations})

    return sections


def find_castle(page_name: str, castles: list[dict]) -> dict | None:
    resolved = PAGE_NAME_ALIASES.get(page_name, page_name)
    target = norm(resolved)
    for castle in castles:
        if norm(castle["name"]) == target:
            return castle
    for castle in castles:
        castle_norm = norm(castle["name"])
        if castle_norm.startswith(target) or target.startswith(castle_norm):
            return castle
    return None


def assign_hours(
    stamps: list[dict],
    source_locations: list[dict],
) -> dict[int, str]:
    pairs: list[tuple[int, int, int]] = []
    for stamp_index, stamp in enumerate(stamps):
        google_label = stamp.get("googleLabel", "")
        for loc_index, location in enumerate(source_locations):
            score = match_score(google_label, location["name"])
            if score > 0:
                pairs.append((score, stamp_index, loc_index))
    pairs.sort(reverse=True)

    used_stamps: set[int] = set()
    used_locations: set[int] = set()
    assignments: dict[int, str] = {}
    for score, stamp_index, loc_index in pairs:
        if score < 25:
            continue
        if stamp_index in used_stamps or loc_index in used_locations:
            continue
        hours = ja_hours_to_zh(source_locations[loc_index]["hours"])
        if hours:
            assignments[stamp_index] = hours
            used_stamps.add(stamp_index)
            used_locations.add(loc_index)
    return assignments


def load_overrides() -> tuple[dict[str, str], dict[str, dict[str, str]]]:
    if not OVERRIDES_PATH.exists():
        return {}, {}
    data = json.loads(OVERRIDES_PATH.read_text(encoding="utf-8"))
    return (
        data.get("byGoogleLabel", {}),
        data.get("byCastleId", {}),
    )


def resolve_override(
    castle_id: int,
    google_label: str,
    by_google_label: dict[str, str],
    by_castle_id: dict[str, dict[str, str]],
) -> str | None:
    castle_overrides = by_castle_id.get(str(castle_id), {})
    if google_label in castle_overrides:
        return castle_overrides[google_label]
    return by_google_label.get(google_label)


def apply_series(
    series: str,
    sections: list[dict],
    castles: list[dict],
    content: dict,
    by_google_label: dict[str, str],
    by_castle_id: dict[str, dict[str, str]],
) -> dict[str, int]:
    stats = {
        "castles": 0,
        "stampPoints": 0,
        "withHours": 0,
        "fromSource": 0,
        "fromOverrides": 0,
        "missing": 0,
    }

    section_by_castle_id: dict[int, dict] = {}
    for section in sections:
        castle = find_castle(section["pageName"], castles)
        if castle:
            section_by_castle_id[castle["id"]] = section

    for castle in castles:
        entry = content.setdefault(str(castle["id"]), {})
        stamps = entry.get("stampLocations") or []
        if not stamps:
            continue

        stats["castles"] += 1
        section = section_by_castle_id.get(castle["id"])
        assignments = (
            assign_hours(stamps, section["locations"]) if section else {}
        )

        for stamp_index, stamp in enumerate(stamps):
            stats["stampPoints"] += 1
            google_label = stamp.get("googleLabel", "")
            hours = assignments.get(stamp_index)
            if hours:
                stats["fromSource"] += 1
            else:
                override = resolve_override(
                    castle["id"],
                    google_label,
                    by_google_label,
                    by_castle_id,
                )
                if override:
                    hours = override
                    stats["fromOverrides"] += 1

            if hours:
                stamp["businessHours"] = hours
                stats["withHours"] += 1
            else:
                stamp.pop("businessHours", None)
                stats["missing"] += 1

    return stats


def main() -> int:
    apply_changes = "--apply" in sys.argv
    castles = json.loads(CASTLES_PATH.read_text(encoding="utf-8"))
    content = json.loads(CONTENT_PATH.read_text(encoding="utf-8"))
    by_google_label, by_castle_id = load_overrides()

    all_stats: dict[str, dict[str, int]] = {}
    for series, config in SERIES_CONFIG.items():
        html = fetch_source_html(config["sourceUrl"])
        sections = parse_stamp_sections(html, config["headerPattern"])
        series_castles = [castle for castle in castles if castle["series"] == series]
        all_stats[series] = apply_series(
            series,
            sections,
            series_castles,
            content,
            by_google_label,
            by_castle_id,
        )

    print(json.dumps(all_stats, ensure_ascii=False, indent=2))

    if apply_changes:
        CONTENT_PATH.write_text(
            json.dumps(content, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"Updated {CONTENT_PATH}")
    else:
        print("Dry run only. Re-run with --apply to write changes.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
