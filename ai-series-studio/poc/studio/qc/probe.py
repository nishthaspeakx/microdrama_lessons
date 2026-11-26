"""Tier 1 technical probe: code only, free, runs on every file."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path


def _ffmpeg_filter(path: str, vf: str | None = None, af: str | None = None) -> str:
    cmd = ["ffmpeg", "-v", "info", "-i", path]
    cmd += ["-vf", vf] if vf else ["-vn"]
    cmd += ["-af", af] if af else ["-an"]
    cmd += ["-f", "null", "-"]
    return subprocess.run(cmd, capture_output=True, text=True, timeout=600).stderr


def tier1(path: str, seconds: float | None = None, width: int | None = None, height: int | None = None,
          expect_audio: bool | None = None, planned_black_end_s: float = 0.0) -> dict:
    """planned_black_end_s: length of an intended cut to black at the end (info, not a defect)."""
    findings, info = [], {}
    try:
        meta = json.loads(subprocess.run(
            ["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", path],
            capture_output=True, text=True, check=True, timeout=60).stdout)
    except subprocess.CalledProcessError as e:
        return {"pass": False, "findings": [{"check": "integrity", "severity": "critical", "detail": e.stderr[:300]}]}
    v = next((s for s in meta["streams"] if s["codec_type"] == "video"), None)
    a = next((s for s in meta["streams"] if s["codec_type"] == "audio"), None)
    if not v:
        findings.append({"check": "integrity", "severity": "critical", "detail": "no video stream"})
        return {"pass": False, "findings": findings}
    info.update(width=v["width"], height=v["height"], duration=float(meta["format"]["duration"]),
                fps=v.get("avg_frame_rate"), audio=bool(a))
    if seconds is not None and abs(info["duration"] - seconds) > 0.5:
        findings.append({"check": "duration", "severity": "minor", "detail": f"{info['duration']:.2f}s vs {seconds}s"})
    if width and height and (info["width"], info["height"]) != (width, height):
        findings.append({"check": "resolution", "severity": "major", "detail": f"{info['width']}x{info['height']} vs {width}x{height}"})
    if info["height"] * 9 != info["width"] * 16 and abs(info["height"] / info["width"] - 16 / 9) > 0.01:
        findings.append({"check": "aspect", "severity": "major", "detail": f"{info['width']}x{info['height']} is not 9:16"})
    if expect_audio is not None and expect_audio != info["audio"]:
        findings.append({"check": "audio_presence", "severity": "major", "detail": f"audio={info['audio']}"})

    vf_out = _ffmpeg_filter(path, vf="blackdetect=d=0.25:pix_th=0.08,freezedetect=n=0.003:d=1.0")
    for m in re.finditer(r"black_start:([\d.]+) black_end:([\d.]+)", vf_out):
        a_, b_ = float(m[1]), float(m[2])
        planned = planned_black_end_s and b_ >= info["duration"] - 0.1 and (b_ - a_) <= planned_black_end_s + 0.1
        findings.append({"check": "black_frames", "severity": "info" if planned else "major", "t_start": a_, "t_end": b_,
                         **({"detail": "planned cut to black"} if planned else {})})
    for m in re.finditer(r"freeze_start: ([\d.]+)", vf_out):
        findings.append({"check": "frozen_frames", "severity": "minor", "t_start": float(m[1])})
    if a:
        af_out = _ffmpeg_filter(path, af="ebur128=peak=true")
        lufs = re.findall(r"I:\s+(-?[\d.]+) LUFS", af_out)
        peak = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", af_out)
        info["lufs"] = float(lufs[-1]) if lufs else None
        info["true_peak_db"] = float(peak[-1]) if peak else None
        if info["true_peak_db"] is not None and info["true_peak_db"] > -1.0:
            findings.append({"check": "clipping", "severity": "major", "detail": f"true peak {info['true_peak_db']} dBTP"})
    worst = {f["severity"] for f in findings}
    return {"pass": not ({"critical", "major"} & worst), "info": info, "findings": findings}
