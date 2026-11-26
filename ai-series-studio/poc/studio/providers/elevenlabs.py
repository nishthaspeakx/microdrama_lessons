"""ElevenLabs REST client for locked character voices. Env: ELEVENLABS_API_KEY.

TTS returns character-level alignment only; word timings come from forced
alignment (docs/research/AUDIO_WORKFLOW_AGENT_VERIFICATION.md).
"""
from __future__ import annotations

import base64
import os
from pathlib import Path

import requests

BASE = "https://api.elevenlabs.io/v1"


class ElevenLabs:
    def __init__(self, api_key: str | None = None):
        api_key = api_key or os.environ.get("ELEVENLABS_API_KEY")
        if not api_key:
            raise RuntimeError("ELEVENLABS_API_KEY is not set")
        self._h = {"xi-api-key": api_key}

    def tts(self, voice_id: str, text: str, dest: Path, model: str = "eleven_v4",
            settings: dict | None = None) -> dict:
        """Speak one script line; save MP3; return character alignment."""
        r = requests.post(f"{BASE}/text-to-speech/{voice_id}/with-timestamps",
                          params={"output_format": "mp3_44100_128"}, headers=self._h, timeout=120,
                          json={"text": text, "model_id": model, **({"voice_settings": settings} if settings else {})})
        r.raise_for_status()
        data = r.json()
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(base64.b64decode(data["audio_base64"]))
        return data.get("alignment") or {}

    def forced_alignment(self, audio: Path, text: str) -> dict:
        """Word and character timings for a known line."""
        with open(audio, "rb") as f:
            r = requests.post(f"{BASE}/forced-alignment", headers=self._h, timeout=300,
                              files={"file": (audio.name, f)}, data={"text": text})
        r.raise_for_status()
        return r.json()
