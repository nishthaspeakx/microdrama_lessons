"""SQLite store and content-addressed asset storage for the PoC."""
from __future__ import annotations

import hashlib
import json
import mimetypes
import shutil
import sqlite3
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path

from . import DATA, REPO_ROOT

DB_PATH = DATA / "studio.db"
ASSETS = DATA / "assets"
SCHEMA = Path(__file__).with_name("schema.sql")


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def new_id() -> str:
    return str(uuid.uuid4())


def connect() -> sqlite3.Connection:
    DATA.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA.read_text())
    return con


def j(value) -> str:
    return json.dumps(value, ensure_ascii=False)


def log(con: sqlite3.Connection, kind: str, data) -> None:
    con.execute("INSERT INTO event_log (at, kind, data) VALUES (?,?,?)", (now(), kind, j(data)))


def _probe(path: Path) -> dict:
    """Width, height, duration and fps from ffprobe; empty if not media."""
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", str(path)],
            capture_output=True, text=True, check=True, timeout=60,
        ).stdout
    except (subprocess.SubprocessError, FileNotFoundError):
        return {}
    info = json.loads(out)
    meta: dict = {}
    for s in info.get("streams", []):
        if s.get("codec_type") == "video":
            meta["width"], meta["height"] = s.get("width"), s.get("height")
            rate = s.get("avg_frame_rate", "0/1")
            num, den = (int(x) for x in rate.split("/")) if "/" in rate else (0, 1)
            if den and num:
                meta["fps"] = round(num / den, 3)
    dur = info.get("format", {}).get("duration")
    if dur and path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
        meta["duration_ms"] = int(float(dur) * 1000)
    return meta


def store_file(con: sqlite3.Connection, path: Path, kind: str, origin: str = "upload",
               provider_job_id: str | None = None) -> str:
    """Copy a file into content-addressed storage once; return its sha256 id."""
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if con.execute("SELECT 1 FROM asset WHERE id=?", (digest,)).fetchone():
        return digest
    rel = Path(digest[:2]) / f"{digest}{path.suffix.lower()}"
    dest = ASSETS / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".tmp")
    shutil.copyfile(path, tmp)
    tmp.replace(dest)  # write to a temp path, then move: never a half-written asset
    meta = _probe(path)
    try:
        source = str(path.resolve().relative_to(REPO_ROOT))
    except ValueError:
        source = None  # never record absolute local paths
    con.execute(
        """INSERT INTO asset (id, kind, mime, bytes, width, height, duration_ms, fps,
           storage_key, origin, source_path, provider_job_id, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (digest, kind, mimetypes.guess_type(path.name)[0], path.stat().st_size,
         meta.get("width"), meta.get("height"), meta.get("duration_ms"), meta.get("fps"),
         str(rel), origin, source, provider_job_id, now()),
    )
    return digest


def asset_path(asset_id: str) -> Path:
    con = connect()
    row = con.execute("SELECT storage_key FROM asset WHERE id=?", (asset_id,)).fetchone()
    if not row:
        raise KeyError(asset_id)
    return ASSETS / row["storage_key"]
