"""Cost estimate for a production plan, from the versioned price table."""
from __future__ import annotations

import json
from pathlib import Path

PRICES = json.loads(Path(__file__).with_name("prices.json").read_text())


def _video_rate(model: str) -> tuple[float, bool]:
    p = PRICES["video"][model]
    return p["per_second_usd"], p["verified"]


def estimate_plan(plan_path: str) -> dict:
    plan = json.loads(Path(plan_path).read_text())
    units = plan["units"]
    model = plan["generation"]["model"]
    rate, verified = _video_rate(model)
    one_pass = sum(u["seconds"] for u in units)
    factor = plan["generation"]["retake_factor"]
    tests = sum(t["seconds"] for t in plan["generation"].get("tests", []))
    video = (one_pass * factor + tests) * rate

    img_price = PRICES["image"][plan["images"]["model"]]["per_image_usd"]
    images = plan["images"]["count"] * img_price

    tts = plan["audio"]["tts_chars"] / 1000 * PRICES["voice"]["elevenlabs.v4.tts"]["per_1k_chars_usd"]
    lip = plan["audio"]["lipsync_seconds"] * PRICES["lipsync"][plan["audio"]["lipsync_model"]]["per_second_usd"]
    up = plan["finish"]["upscale_seconds"] * PRICES["upscale"]["fal.topaz.1080p"]["per_second_usd"]
    llm_low, llm_high = plan["llm_usd"]

    low = video + images + tts + lip + up + llm_low
    high = video * plan["generation"].get("high_factor", 1.4) + images + tts + lip + up + llm_high
    return {
        "price_table": PRICES["version"],
        "video": {"model": model, "per_second_usd": rate, "rate_verified": verified,
                  "seconds_one_pass": one_pass, "retake_factor": factor, "test_seconds": tests,
                  "seconds_generated": round(one_pass * factor + tests), "usd": round(video, 2)},
        "images_usd": round(images, 2), "tts_usd": round(tts, 2), "lipsync_usd": round(lip, 2),
        "upscale_usd": round(up, 2), "llm_usd": [llm_low, llm_high],
        "total_usd": [round(low, 2), round(high, 2)],
        "warning": None if verified else f"{model} rate is not verified for the target resolution; settle before spending",
    }
