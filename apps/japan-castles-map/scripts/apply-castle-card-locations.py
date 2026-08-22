#!/usr/bin/env python3
"""Merge castle-card-sales.json into castle-content.zh-Hant.json."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CASTLES_PATH = ROOT / "assets" / "castles.json"
CONTENT_PATH = ROOT / "assets" / "i18n" / "castle-content.zh-Hant.json"
SALES_PATH = ROOT / "data-source" / "castle-card-sales.json"


def norm(text: str) -> str:
    return re.sub(
        r"[\s　・（）()「」『』\[\]【】※\-－—–~～:：;；,，.．/／\\]",
        "",
        text,
    )


def match_score(google_label: str, candidate: str) -> int:
    n1, n2 = norm(google_label), norm(candidate)
    if not n1 or not n2:
        return 0
    if n1 in n2 or n2 in n1:
        return 100
    tokens1 = set(re.findall(r"[\u4e00-\u9fff\u30a0-\u30ffA-Za-z]{2,}", google_label))
    tokens2 = set(re.findall(r"[\u4e00-\u9fff\u30a0-\u30ffA-Za-z]{2,}", candidate))
    return len(tokens1 & tokens2) * 25


def resolve_coordinates(
    google_label: str,
    entry: dict,
    castle: dict,
) -> tuple[float | None, float | None]:
    best_score = 0
    best_coords: tuple[float | None, float | None] = (None, None)

    for point in entry.get("stampLocations") or []:
        for key in ("googleLabel", "label"):
            candidate = point.get(key, "")
            score = match_score(google_label, candidate)
            if score > best_score and point.get("latitude") is not None:
                best_score = score
                best_coords = (point.get("latitude"), point.get("longitude"))

    for point in (entry.get("driving") or {}).get("parkingLocations") or []:
        candidate = point.get("googleLabel") or point.get("label") or ""
        score = match_score(google_label, candidate)
        if score > best_score and point.get("latitude") is not None:
            best_score = score
            best_coords = (point.get("latitude"), point.get("longitude"))

    if best_score >= 25:
        return best_coords

    stamp_lat = castle.get("latitude_stamp")
    stamp_lng = castle.get("longitude_stamp")
    if stamp_lat is not None and stamp_lng is not None:
        return stamp_lat, stamp_lng

    return castle.get("latitude"), castle.get("longitude")


def enrich_hours(
    google_label: str,
    business_hours: str | None,
    entry: dict,
) -> str | None:
    if business_hours:
        return business_hours

    best_score = 0
    best_hours: str | None = None
    for point in entry.get("stampLocations") or []:
        hours = point.get("businessHours")
        if not hours:
            continue
        for key in ("googleLabel", "label"):
            score = match_score(google_label, point.get(key, ""))
            if score > best_score:
                best_score = score
                best_hours = hours

    if best_score >= 25:
        return best_hours
    return None


def main() -> int:
    apply_changes = "--apply" in sys.argv

    castles = json.loads(CASTLES_PATH.read_text(encoding="utf-8"))
    content = json.loads(CONTENT_PATH.read_text(encoding="utf-8"))
    sales = json.loads(SALES_PATH.read_text(encoding="utf-8"))

    castle_by_number = {
        (castle["series"], castle["number"]): castle for castle in castles
    }

    stats = {"castles": 0, "locations": 0}

    for series, entries in sales["series"].items():
        for number_key, locations in entries.items():
            number = int(number_key)
            castle = castle_by_number.get((series, number))
            if not castle:
                continue

            entry = content.setdefault(str(castle["id"]), {})
            card_locations = []

            for loc in locations:
                google_label = loc["googleLabel"]
                lat, lng = resolve_coordinates(google_label, entry, castle)
                hours = enrich_hours(google_label, loc.get("businessHours"), entry)
                card_locations.append(
                    {
                        "label": loc["label"],
                        "googleLabel": google_label,
                        **({"latitude": lat, "longitude": lng} if lat is not None and lng is not None else {}),
                        **({"businessHours": hours} if hours else {}),
                    }
                )

            if card_locations:
                entry["castleCardLocations"] = card_locations
                stats["castles"] += 1
                stats["locations"] += len(card_locations)
            else:
                entry.pop("castleCardLocations", None)

    print(json.dumps(stats, ensure_ascii=False, indent=2))

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
