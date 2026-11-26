"""Higgsfield REST API client (docs.higgsfield.ai, read 2026-11-26).

Separate product from the Higgsfield website plan and MCP: API keys,
prepaid USD balance. Env: HF_API_KEY_ID, HF_API_KEY_SECRET.

Facts used here:
- Auth header `Authorization: Key KEY_ID:KEY_SECRET`.
- Submit: POST /{endpoint_id} -> {status, request_id, status_url, cancel_url}.
- Status: GET status_url -> status in queued|in_progress|completed|failed|nsfw|canceled;
  video at top-level `video.url`, images at `images[].url`.
- `Idempotency-Key` header: same key + same params returns the original request,
  no new charge; same key + different params -> 422.
- Estimate: POST /estimate/{endpoint_id} with the same body -> {"usd": "..."}.
- Uploads: POST /files/generate-upload-url {content_type} -> presigned PUT; use public_url.
- Seedance requires public URLs; outputs are deleted after 7 days.
- Failed and nsfw requests are not charged.
- Webhooks follow the Standard Webhooks signature scheme.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import mimetypes
import os
import random
import time
from pathlib import Path

import requests

BASE = "https://api.higgsfield.ai"
SEEDANCE_REF = "bytedance/seedance-2.0/reference-to-video"
SEEDANCE_I2V = "bytedance/seedance-2.0/image-to-video"
GROK_IMAGE = "xai/grok-imagine-image-2.0"
TERMINAL = {"completed", "failed", "nsfw", "canceled"}


class HiggsfieldError(RuntimeError):
    pass


class Higgsfield:
    def __init__(self, key_id: str | None = None, key_secret: str | None = None, timeout: float = 60):
        key_id = key_id or os.environ.get("HF_API_KEY_ID")
        key_secret = key_secret or os.environ.get("HF_API_KEY_SECRET")
        if not key_id or not key_secret:
            raise HiggsfieldError("HF_API_KEY_ID and HF_API_KEY_SECRET are not set")
        self._auth = {"Authorization": f"Key {key_id}:{key_secret}"}
        self.timeout = timeout

    def _post(self, path: str, body: dict, headers: dict | None = None, params: dict | None = None) -> dict:
        r = requests.post(f"{BASE}/{path}", json=body, headers={**self._auth, **(headers or {})},
                          params=params, timeout=self.timeout)
        if r.status_code == 429:
            raise HiggsfieldError(f"queue full, retry after {r.headers.get('Retry-After')} s: {r.text[:300]}")
        if r.status_code >= 400:
            raise HiggsfieldError(f"{r.status_code} {path}: {r.text[:500]}")
        return r.json() if r.content else {}

    # Free calls -----------------------------------------------------------
    def estimate(self, endpoint_id: str, body: dict) -> float:
        """Authoritative price for this account, in USD, without generating."""
        return float(self._post(f"estimate/{endpoint_id}", body)["usd"])

    def upload(self, path: Path) -> str:
        """Upload a local file; return the public URL to pass to a model."""
        ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        slot = self._post("files/generate-upload-url", {"content_type": ctype})
        # Never send Higgsfield credentials to the presigned URL.
        r = requests.put(slot["upload_url"], data=path.read_bytes(), headers=slot["upload_headers"], timeout=300)
        r.raise_for_status()
        return slot["public_url"]

    def status(self, status_url: str) -> dict:
        r = requests.get(status_url, headers=self._auth, timeout=self.timeout)
        if r.status_code >= 500:
            return {"status": "unknown", "error": f"{r.status_code}"}
        r.raise_for_status()
        return r.json()

    # Paid call ------------------------------------------------------------
    def submit(self, endpoint_id: str, body: dict, idempotency_key: str, webhook_url: str | None = None) -> dict:
        """Submit a generation. Only call after the ledger has reserved the cost."""
        params = {"hf_webhook": webhook_url} if webhook_url else None
        return self._post(endpoint_id, body, headers={"Idempotency-Key": idempotency_key}, params=params)

    def wait(self, status_url: str, timeout_s: float = 1800) -> dict:
        """Poll with backoff: 2 s growing x1.5 to 10 s, with jitter."""
        delay, deadline = 2.0, time.monotonic() + timeout_s
        while True:
            st = self.status(status_url)
            if st.get("status") in TERMINAL:
                return st
            if time.monotonic() > deadline:
                raise HiggsfieldError(f"timed out waiting for {status_url}")
            time.sleep(delay + random.uniform(0, 0.5))
            delay = min(delay * 1.5, 10.0)

    @staticmethod
    def download(url: str, dest: Path) -> Path:
        """Copy an output to our storage at once (Higgsfield deletes after 7 days)."""
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_suffix(dest.suffix + ".part")
        with requests.get(url, stream=True, timeout=300) as r:
            r.raise_for_status()
            with open(tmp, "wb") as f:
                for chunk in r.iter_content(1 << 20):
                    f.write(chunk)
        tmp.replace(dest)
        return dest


def seedance_reference_body(prompt: str, image_urls: list[str], seconds: int, resolution: str,
                            audio: bool = False, aspect: str = "9:16") -> dict:
    if not 4 <= seconds <= 15:
        raise ValueError("Seedance 2.0 takes 4 to 15 seconds")
    if not 1 <= len(image_urls) <= 9:
        raise ValueError("Seedance 2.0 takes 1 to 9 reference images")
    if resolution not in {"480p", "720p", "1080p", "4k"}:
        raise ValueError(resolution)
    return {"prompt": prompt, "image_urls": image_urls, "duration": seconds, "resolution": resolution,
            "aspect_ratio": aspect, "generate_audio": audio}


def seedance_first_frame_body(prompt: str, first_frame_url: str, seconds: int, resolution: str,
                              last_frame_url: str | None = None, audio: bool = False) -> dict:
    body = {"prompt": prompt, "image_url": first_frame_url, "duration": seconds, "resolution": resolution,
            "generate_audio": audio}
    if last_frame_url:
        body["end_image_url"] = last_frame_url
    return body


def verify_webhook(secret: str, headers: dict, raw_body: bytes, tolerance_s: int = 300) -> bool:
    """Standard Webhooks verification, done on the raw body before parsing."""
    msg_id, ts, sigs = headers.get("webhook-id"), headers.get("webhook-timestamp"), headers.get("webhook-signature", "")
    if not msg_id or not ts or abs(time.time() - int(ts)) > tolerance_s:
        return False
    key = base64.b64decode(secret.removeprefix("whsec_"))
    expected = base64.b64encode(hmac.new(key, f"{msg_id}.{ts}.".encode() + raw_body, hashlib.sha256).digest()).decode()
    return any(hmac.compare_digest(expected, s.split(",", 1)[1]) for s in sigs.split() if s.startswith("v1,"))
