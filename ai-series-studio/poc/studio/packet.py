"""Continuity packet: everything true at the start of an episode.

This, not the previous MP4, is the input to script checks and planning
(docs/CHARACTER_VOICE_CONTINUITY_SYSTEM.md section 5).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from . import POC_ROOT
from .db import connect

SERIES_ID = "madhopur"


def _episode_of(marker: str | None) -> int | None:
    """'e1:s3' -> 1, 'e2' -> 2, 'bible:v1' -> 0 (series-level), None -> None."""
    if marker is None:
        return None
    if marker.startswith("bible:"):
        return 0
    m = re.match(r"e(\d+)", marker)
    return int(m.group(1)) if m else None


def build_packet(episode: int) -> dict:
    con = connect()
    rows = lambda q, *a: [dict(r) for r in con.execute(q, a)]
    facts = []
    for f in rows("SELECT * FROM continuity_fact WHERE series_id=?", SERIES_ID):
        start, end = _episode_of(f["valid_from"]), _episode_of(f["valid_to"])
        if start is not None and start < episode and (end is None or end >= episode):
            f["data"] = json.loads(f["data"]) if f["data"] else None
            facts.append(f)
    prev = con.execute(
        "SELECT e.number, e.title, e.title_en, s.* FROM episode e JOIN episode_summary s ON s.episode_id=e.id "
        "WHERE e.series_id=? AND e.number=?", (SERIES_ID, episode - 1)).fetchone()
    chars = rows("SELECT key, name, protected, age_statement, age_source, profile, speech_style, locked FROM character WHERE series_id=?", SERIES_ID)
    for c in chars:
        c["profile"] = json.loads(c["profile"]) if c["profile"] else None
        c["looks"] = rows(
            "SELECT l.key, l.status, l.wardrobe, (SELECT json_group_array(angle) FROM reference_image r WHERE r.subject_id=l.id) AS refs "
            "FROM character_look l WHERE l.character_id=?", f"{SERIES_ID}:{c['key']}")
        for l in c["looks"]:
            l["wardrobe"] = json.loads(l["wardrobe"]) if l["wardrobe"] else None
            l["refs"] = json.loads(l["refs"])
    style = con.execute("SELECT data FROM style_guide WHERE series_id=? ORDER BY bible_version DESC LIMIT 1", (SERIES_ID,)).fetchone()
    bible = con.execute("SELECT version FROM bible_version WHERE series_id=? AND status='approved' ORDER BY version DESC LIMIT 1", (SERIES_ID,)).fetchone()
    return {
        "series": SERIES_ID,
        "for_episode": episode,
        "bible_version": bible["version"] if bible else None,
        "previous_episode": None if not prev else {
            "number": prev["number"], "title": prev["title"], "title_en": prev["title_en"],
            "summary": prev["summary"], "end_states": json.loads(prev["end_states"]),
            "cliffhanger": prev["cliffhanger"], "key_frames": json.loads(prev["key_frames"]),
        },
        "facts": sorted(facts, key=lambda f: (f["kind"], f["subject_key"])),
        "open_threads": [f["statement"] for f in facts if f["kind"] == "open_thread"],
        "characters": chars,
        "locations": rows("SELECT key, name, description FROM location WHERE series_id=?", SERIES_ID),
        "props": rows("SELECT key, name, description FROM prop WHERE series_id=?", SERIES_ID),
        "style": json.loads(style["data"]) if style else None,
    }


def write_packet(packet: dict) -> str:
    out = POC_ROOT / "episodes" / f"ep{packet['for_episode']}" / "continuity-packet.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(packet, ensure_ascii=False, indent=2))
    return f"{out.relative_to(POC_ROOT)}: {len(packet['facts'])} facts, {len(packet['open_threads'])} open threads, {len(packet['characters'])} characters"
