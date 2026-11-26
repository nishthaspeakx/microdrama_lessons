"""Import the approved Madhopur Episode 1 into the PoC store as Bible version 1.

Sources (all already in the repository):
- madhopur/episode-1/revised/plan/ep1-revised-continuity-bible.json (the
  locked prototype cut's plan; supersedes the first cut)
- madhopur/episode-1/plan/ep1-continuity-bible.json (for Yash and young
  Nikhil, cut from the revised episode but still in the series)
- madhopur/episode-1/references/ and revised/references/ (approved images)
- madhopur/episode-1/revised/edit/cut-list.json and the final video
"""
from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

from . import REPO_ROOT
from .db import connect, j, log, new_id, now, store_file

EP1 = REPO_ROOT / "madhopur" / "episode-1"
REVISED = EP1 / "revised"
FINAL_VIDEO = REVISED / "final" / "ep1-revised-edited-subtitled-1080x1920.mp4"
SERIES_ID = "madhopur"

# Ages stated by the owner. Children have no stated age, so they are protected.
ADULT_SOURCES = {"user", "user_adult"}


def _bible(path: Path) -> dict:
    return json.loads(path.read_text())


def _protected(c: dict) -> bool:
    """Protected unless the owner or script states an adult age."""
    return not (c.get("age_source") in ADULT_SOURCES and (c.get("age") is None or c["age"] >= 18))


def import_episode1() -> dict:
    con = connect()
    revised = _bible(REVISED / "plan" / "ep1-revised-continuity-bible.json")
    original = _bible(EP1 / "plan" / "ep1-continuity-bible.json")
    counts = {"characters": 0, "looks": 0, "references": 0, "locations": 0, "props": 0, "facts": 0}

    with con:
        # Re-runnable: every row below has a deterministic id and is upserted.
        con.execute(
            "INSERT INTO series (id, slug, name, name_en, status, production_mode, config, current_bible_version, budget_episode_cents) "
            "VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, name_en=excluded.name_en, "
            "status=excluded.status, production_mode=excluded.production_mode, config=excluded.config, "
            "current_bible_version=excluded.current_bible_version, budget_episode_cents=excluded.budget_episode_cents",
            (SERIES_ID, "madhopur-ka-raaz", "मधोपुर का राज़", "The Secret of Madhopur", "in_production",
             "script_driven",
             j({"aspect": "9:16", "fps": 24, "master": [1080, 1920], "language": "Hinglish (Devanagari dialogue)",
                "episodes_planned": 5, "target_seconds": [95, 110], "setting": "Madhopur, fictional central Indian farming town; 2014, then twelve years later",
                "look_id": revised.get("look"), "style_id": revised.get("style_id")}),
             1, 6000),
        )
        con.execute(
            "INSERT OR REPLACE INTO style_guide (series_id, bible_version, data) VALUES (?,?,?)",
            (SERIES_ID, 1, j({
                "style": revised["style"],
                "card_style": json.loads((REVISED / "edit" / "card_style.json").read_text()),
                "rules": [
                    "Keep faces large and eyes readable on a phone; leave top and bottom of frame for app UI.",
                    "Still or gently moving frames for family scenes; abrupt camera only for impacts and emergencies.",
                    "Kitchen: single warm practical light, subdued shadows, straight eye-level singles.",
                    "Spacecraft: cool neutral metal against warm earth; one design, one hatch angle.",
                    "Dialogue in Devanagari; subtitles from the script text.",
                ],
            })),
        )

        # Characters: the revised six, plus Yash and young Nikhil from the first cut.
        chars = list(revised["characters"])
        chars += [c for c in original["characters"] if c["id"] in ("yash", "nikhil")]
        for c in chars:
            in_revised = any(rc["id"] == c["id"] for rc in revised["characters"])
            key = "veer" if c["id"] == "boy" else c["id"]
            cid = f"{SERIES_ID}:{key}"
            con.execute(
                "INSERT INTO character (id, series_id, key, name, aliases, being, role, age_statement, age_source, "
                "protected, profile, speech_style, locked) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) "
                "ON CONFLICT(id) DO UPDATE SET name=excluded.name, aliases=excluded.aliases, role=excluded.role, "
                "age_statement=excluded.age_statement, age_source=excluded.age_source, protected=excluded.protected, "
                "profile=excluded.profile, speech_style=excluded.speech_style, locked=excluded.locked",
                (cid, SERIES_ID, key, "Veer" if key == "veer" else c["name"], j(c.get("aliases", [])),
                 c.get("being", "human"), c.get("role"),
                 None if c.get("age") is None else str(c["age"]), c.get("age_source"),
                 int(_protected(c)), j(c.get("profile")), c.get("voice"), int(in_revised)),
            )
            counts["characters"] += 1
            look_key = {"veer": "veer_age5_kurta_2014", "suman": "suman_2014_field", "devendra": "devendra_2014_checked_shirt",
                        "yash": "yash_young_2014", "nikhil": "nikhil_young_2014_red_s"}.get(key, f"{key}_2014")
            lid = f"{cid}:{look_key}"
            con.execute(
                "INSERT INTO character_look (id, character_id, key, kind, description, wardrobe, status, first_episode, last_episode) "
                "VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET description=excluded.description, "
                "wardrobe=excluded.wardrobe, status=excluded.status",
                (lid, cid, look_key, "base", j(c.get("profile")), j(c.get("wardrobe")),
                 "approved" if in_revised else "approved_unused", 1, None),
            )
            counts["looks"] += 1
            for angle in ("face", "outfit", "sheet"):
                img = EP1 / "references" / "characters" / f"{c['id']}-{angle}.png"
                if not img.exists():
                    continue
                aid = store_file(con, img, "image", provider_job_id=c.get(angle))
                con.execute(
                    "INSERT OR REPLACE INTO reference_image (id, subject_type, subject_id, asset_id, angle, provider_handle, approved) "
                    "VALUES (?,?,?,?,?,?,?)",
                    (f"{lid}:{angle}", "look", lid, aid, angle, j({"higgsfield_job": c.get(angle)}), 1),
                )
                counts["references"] += 1

        for loc in revised["locations"]:
            locid = f"{SERIES_ID}:{loc['id']}"
            con.execute(
                "INSERT INTO location (id, series_id, key, name, description, period, fixed_features) VALUES (?,?,?,?,?,?,?) "
                "ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, fixed_features=excluded.fixed_features",
                (locid, SERIES_ID, loc["id"], loc["name"], loc["look"], "2014", j(loc.get("map"))),
            )
            img = EP1 / "references" / "locations" / f"{loc['id']}.png"
            aid = store_file(con, img, "image", provider_job_id=loc.get("job")) if img.exists() else None
            con.execute(
                "INSERT OR REPLACE INTO location_view (id, location_id, key, hour, light, asset_id, provider_handle, approved) VALUES (?,?,?,?,?,?,?,?)",
                (f"{locid}:wide", locid, "wide", loc.get("hour"), j(loc.get("light")), aid, j({"higgsfield_job": loc.get("job")}), 1),
            )
            counts["locations"] += 1

        for p in revised["props"]:
            img = EP1 / "references" / "props" / f"{p['id']}.png"
            if not img.exists():
                img = REVISED / "references" / f"{p['id']}.png"
            aid = store_file(con, img, "image", provider_job_id=p.get("job")) if img.exists() else None
            owner = p.get("carried_by")
            con.execute(
                "INSERT OR REPLACE INTO prop (id, series_id, key, name, description, owner_character_id, asset_id, provider_handle) VALUES (?,?,?,?,?,?,?,?)",
                (f"{SERIES_ID}:{p['id']}", SERIES_ID, p["id"], p["name"], p["look"],
                 f"{SERIES_ID}:{owner}" if owner else None, aid, j({"higgsfield_job": p.get("job")})),
            )
            counts["props"] += 1

        con.execute(
            "INSERT OR IGNORE INTO episode (id, series_id, number, title, title_en, status, approved_version, target_seconds) VALUES (?,?,?,?,?,?,?,?)",
            (f"{SERIES_ID}:e1", SERIES_ID, 1, "आसमान से क्या गिरा?", "What fell from the sky?", "approved", 2, 90),
        )
        con.execute(
            "INSERT OR IGNORE INTO episode (id, series_id, number, title, title_en, status, target_seconds) VALUES (?,?,?,?,?,?,?)",
            (f"{SERIES_ID}:e2", SERIES_ID, 2, "आज से ये हमारा बेटा है", "From today he is our son", "awaiting_script", 110),
        )

        con.execute("DELETE FROM continuity_fact WHERE series_id=?", (SERIES_ID,))
        for f in EP1_FACTS:
            con.execute(
                "INSERT INTO continuity_fact (id, series_id, subject_type, subject_key, kind, statement, data, permanence, valid_from, valid_to, story_time, source, confidence) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (new_id(), SERIES_ID, f["subject_type"], f["subject"], f["kind"], f["statement"], j(f.get("data")),
                 f.get("permanence", "temporary"), f["from"], f.get("to"), f.get("story_time", "2014"),
                 f.get("source", "approved_episode:e1v2"), f.get("confidence", "stated")),
            )
            counts["facts"] += 1

        key_frames = _key_frames(con)
        con.execute(
            "INSERT OR REPLACE INTO episode_summary (episode_id, summary, end_states, cliffhanger, key_frames) VALUES (?,?,?,?,?)",
            (f"{SERIES_ID}:e1", EP1_SUMMARY, j(_end_states(revised)), EP1_CLIFFHANGER, j(key_frames)),
        )

        snapshot = {
            "characters": [r["id"] for r in con.execute("SELECT id FROM character WHERE series_id=?", (SERIES_ID,))],
            "looks": [r["id"] for r in con.execute("SELECT l.id FROM character_look l JOIN character c ON c.id=l.character_id WHERE c.series_id=?", (SERIES_ID,))],
            "locations": [r["id"] for r in con.execute("SELECT id FROM location WHERE series_id=?", (SERIES_ID,))],
            "props": [r["id"] for r in con.execute("SELECT id FROM prop WHERE series_id=?", (SERIES_ID,))],
        }
        con.execute(
            "INSERT OR REPLACE INTO bible_version (series_id, version, status, created_from, change_summary, approved_by, approved_at, snapshot) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (SERIES_ID, 1, "approved", "ingest", "Imported from the approved revised Episode 1 (prototype final cut).",
             "owner (Episode 1 marked final 2026-11-25)", now(), j(snapshot)),
        )
        log(con, "import.episode1", counts)
    counts["key_frames"] = len(key_frames)
    return counts


def _end_states(bible: dict) -> list[dict]:
    last = bible["scenes"][-1]
    return [{"who": e["who"], "where": e["where"], "posture": e["posture"], "scene": last["id"], "location": last["location"]}
            for e in last.get("end", [])]


def _key_frames(con) -> list[dict]:
    """First and last frame of each scene and the final frame, from the final cut."""
    cut = json.loads((REVISED / "edit" / "cut-list.json").read_text())
    bible = _bible(REVISED / "plan" / "ep1-revised-continuity-bible.json")
    scene_of = {f"c{c['n']}": c["scene"] for c in bible["clips"]}
    t, spans, last_picture = 0.0, {}, 0.0
    for seg in cut["segments"]:
        if "black" in seg:  # a black tail, not picture
            t += seg["black"]
            continue
        dur = seg["out"] - seg["in"]
        sc = scene_of.get(seg["clip"], "?")
        start, _ = spans.get(sc, (t, t))
        spans[sc] = (start, t + dur)
        t += dur
        last_picture = t
    black = _black_start(FINAL_VIDEO)
    if black is not None:
        last_picture = min(last_picture, black)
    frames = []
    for sc, (a, b) in spans.items():
        frames.append({"scene": sc, "which": "first", "t": round(a + 0.15, 3)})
        frames.append({"scene": sc, "which": "last", "t": round(min(b, last_picture) - 0.2, 3)})
    frames.append({"scene": "episode", "which": "final_picture", "t": round(last_picture - 0.2, 3)})
    out = []
    with tempfile.TemporaryDirectory() as tmp:
        for f in frames:
            png = Path(tmp) / f"{f['scene']}-{f['which']}.png"
            # Final video includes cards and subtitles; the timing note marks it.
            # Seek after the input: fast seeking landed on wrong frames in this file.
            r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(FINAL_VIDEO), "-ss", str(f["t"]),
                                "-frames:v", "1", str(png)], capture_output=True)
            if r.returncode == 0 and png.exists():
                f["asset_id"] = store_file(con, png, "image", origin="derived")
                out.append(f)
    return out


def _black_start(video: Path) -> float | None:
    """Start of the first black section of 0.3 s or more, if any."""
    r = subprocess.run(["ffmpeg", "-v", "info", "-i", str(video), "-vf", "blackdetect=d=0.3:pix_th=0.08",
                        "-an", "-f", "null", "-"], capture_output=True, text=True)
    for line in r.stderr.splitlines():
        if "black_start:" in line:
            return float(line.split("black_start:")[1].split()[0])
    return None


EP1_SUMMARY = (
    "A blazing object crosses the sky over Madhopur in 2014. In the bazaar young Meera loses sight of her "
    "parents in the dust of an impact and calls for her mother. Villagers watch the object tear through distant "
    "fields and feel one enormous impact. On the farm road, Devendra and Suman Sharma's pickup drops nose-first "
    "into a ditch; a small boy is waiting outside the cracked window. Suman asks if he is hurt and he takes her "
    "hand. At the field's edge Devendra sees a massive dark blade-shaped craft, five storeys high, with a small "
    "open hatch at its base. He whispers Suman's name. The boy holds Suman's hand with both of his; his eyes "
    "glow blue and a pulse of light passes through his kurta."
)
EP1_CLIFFHANGER = "The boy, holding Suman's hand beside the towering craft, looks up with glowing blue eyes."

EP1_FACTS = [
    # Characters and looks
    {"subject_type": "character", "subject": "suman", "kind": "wardrobe", "statement": "Suman wears a sage-green block-print kameez, oatmeal salwar, pale sage dupatta, single low plait.", "from": "e1:s3", "to": None},
    {"subject_type": "character", "subject": "devendra", "kind": "wardrobe", "statement": "Devendra wears a faded red-and-navy checked shirt, sleeves rolled, khaki trousers.", "from": "e1:s3", "to": None},
    {"subject_type": "character", "subject": "veer", "kind": "wardrobe", "statement": "The boy wears a pale cream kurta and grey pyjama, brown chappals.", "from": "e1:s3", "to": None},
    {"subject_type": "character", "subject": "meera", "kind": "wardrobe", "statement": "Young Meera wears a powder-blue flowered frock, two plaits with red ribbons.", "from": "e1:s1", "to": None},
    {"subject_type": "character", "subject": "veer", "kind": "established_fact", "statement": "The boy is unnamed in Episode 1; he will be named Veer.", "from": "e1", "to": None, "permanence": "temporary"},
    {"subject_type": "character", "subject": "veer", "kind": "physical_state", "statement": "The boy's eyes glowed blue and a pulse of light passed through his kurta, once, at the end of Episode 1.", "from": "e1:s4", "to": None, "permanence": "permanent"},
    {"subject_type": "character", "subject": "suman", "kind": "established_fact", "statement": "Suman is 32 and Devendra is 36 in 2014 (owner-stated).", "from": "e1", "permanence": "permanent", "source": "owner"},
    # Knowledge
    {"subject_type": "character", "subject": "suman", "kind": "knowledge", "statement": "Suman and Devendra have seen the craft and the open hatch, and the boy beside it.", "from": "e1:s4", "permanence": "permanent"},
    {"subject_type": "world", "subject": "madhopur", "kind": "event", "statement": "Villagers in the bazaar watched a blazing object streak overhead and felt one enormous impact in distant fields.", "from": "e1:s2", "permanence": "permanent"},
    {"subject_type": "character", "subject": "meera", "kind": "emotional_state", "statement": "Meera lost sight of her parents in the dust after the impact; their fate is not shown.", "from": "e1:s1", "permanence": "temporary"},
    # Places and objects
    {"subject_type": "prop", "subject": "crash_site", "kind": "object_state", "statement": "A massive dark blade-shaped craft about five storeys high stands in torn earth at the end of a swathe of flattened maize, small oval hatch open at its base.", "from": "e1:s4", "permanence": "temporary"},
    {"subject_type": "prop", "subject": "pickup", "kind": "object_state", "statement": "The pale blue pickup is nose-down in the ditch on the farm road, passenger window cracked in a web.", "from": "e1:s3", "permanence": "temporary"},
    {"subject_type": "world", "subject": "craft", "kind": "world_rule", "statement": "The craft is cool, neutral dark metal against warm earth; one design and one hatch angle across the series.", "from": "bible:v1", "permanence": "permanent"},
    # Positions at the end
    {"subject_type": "character", "subject": "suman", "kind": "position", "statement": "Suman kneels at the maize field's edge holding the boy's hands.", "from": "e1:end", "permanence": "temporary"},
    {"subject_type": "character", "subject": "devendra", "kind": "position", "statement": "Devendra stands a step behind Suman.", "from": "e1:end", "permanence": "temporary"},
    # Threads
    {"subject_type": "plotline", "subject": "veer_origin", "kind": "open_thread", "statement": "Where did the boy come from, and what is the craft?", "from": "e1:s4", "permanence": "temporary"},
    {"subject_type": "plotline", "subject": "meera_parents", "kind": "open_thread", "statement": "What happened to Meera's parents?", "from": "e1:s1", "permanence": "temporary"},
    {"subject_type": "plotline", "subject": "cut_from_e1", "kind": "established_fact", "statement": "The revised Episode 1 removed the maize-field post scene with young Yash and young Nikhil; neither appears in Episode 1.", "from": "e1", "permanence": "permanent", "source": "owner (revised cut)"},
    {"subject_type": "plotline", "subject": "e1_cliffhanger", "kind": "cliffhanger", "statement": "The boy, holding Suman's hand beside the towering craft, looks up with glowing blue eyes.", "from": "e1:end", "permanence": "temporary"},
]
