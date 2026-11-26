/**
 * Video generation behind one small interface. Higgsfield REST API (docs read 2026-11-26,
 * https://docs.higgsfield.ai/docs/llms.txt):
 * - Auth header `Authorization: Key KEY_ID:KEY_SECRET` (HIGGSFIELD_API_KEY holds "KEY_ID:KEY_SECRET").
 * - POST /files/generate-upload-url {content_type} → {public_url, upload_url, upload_headers}; PUT the bytes
 *   with every upload header; inputs must be public URLs.
 * - POST /bytedance/seedance-2.0/reference-to-video {prompt, duration 4–15, aspect_ratio, resolution,
 *   image_urls 1–9, audio_urls ≤3 (2–15 s each, 15 s total), generate_audio} → {request_id, status_url}.
 *   Seedance 2.5: duration 4–30, image_urls ≤30, audio_urls ≤10.
 * - GET /requests/{id}/status → queued | in_progress | completed | failed | nsfw | canceled; video.url when completed.
 * - POST /estimate/{endpoint} returns the price list as text (per second by resolution), not a total.
 * VIDEO_PROVIDER=mock (or no key) gives labelled placeholder clips made locally with FFmpeg, at no cost.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { q, one } from "../db";
import { readStored } from "../storage";

const run = promisify(execFile);
const BASE = "https://api.higgsfield.ai";

export type VideoModel = "seedance-2.0" | "seedance-2.5";
export const MODELS: Record<VideoModel, { maxSeconds: number; maxImages: number; maxAudio: number; label: string }> = {
  "seedance-2.0": { maxSeconds: 15, maxImages: 9, maxAudio: 3, label: "Seedance 2.0" },
  "seedance-2.5": { maxSeconds: 30, maxImages: 30, maxAudio: 10, label: "Seedance 2.5" },
};
// Higgsfield's self-serve rates per second of output (from POST /estimate, read 2026-11-26), for image and audio
// references (no video input). The estimate endpoint returns this price list as text, not a total, so the app
// multiplies by the clip length itself.
const USD_PER_S: Record<VideoModel, Record<string, number>> = {
  "seedance-2.0": { "480p": 0.0804, "720p": 0.1735, "1080p": 0.4293 },
  "seedance-2.5": { "480p": 0.1177, "720p": 0.2647, "1080p": 0.6518 },
};

export function videoProvider(): "higgsfield" | "mock" {
  if (process.env.VIDEO_PROVIDER === "mock") return "mock";
  return process.env.HIGGSFIELD_API_KEY?.includes(":") ? "higgsfield" : "mock";
}

export type ClipRequest = {
  model: VideoModel; prompt: string; duration: number; aspect: string; resolution: string;
  imageShas: string[]; audioSha: string | null; label: string;
};

function auth() {
  return { Authorization: `Key ${process.env.HIGGSFIELD_API_KEY}`, "Content-Type": "application/json" };
}

async function fail(res: Response, what: string): Promise<never> {
  const text = await res.text();
  let msg = text.slice(0, 300);
  try {
    const j = JSON.parse(text);
    msg = (typeof j.detail === "string" ? j.detail : j.error ?? j.message ?? JSON.stringify(j.detail ?? j)).slice(0, 300);
  } catch {}
  const err = new Error(`Higgsfield ${what} ${res.status}: ${msg}`);
  // A full queue or a hiccup is worth retrying; bad input or credentials are not.
  throw Object.assign(err, { retryable: res.status === 429 || res.status >= 500 });
}

const UPLOAD_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "audio/wav", "audio/x-wav", "video/mp4"]);

/** Upload a stored file once and reuse its public URL for a day. */
async function publicUrl(sha: string): Promise<string> {
  const hit = await one<{ url: string }>(
    "SELECT url FROM provider_uploads WHERE sha=$1 AND provider='higgsfield' AND created_at > now() - interval '20 hours'", [sha]);
  if (hit) return hit.url;
  const f = await readStored(sha);
  if (!UPLOAD_TYPES.has(f.mime)) throw Object.assign(new Error(`Higgsfield cannot take a ${f.mime} file as a reference.`), { retryable: false });
  const res = await fetch(`${BASE}/files/generate-upload-url`, { method: "POST", headers: auth(), body: JSON.stringify({ content_type: f.mime }) });
  if (!res.ok) await fail(res, "upload URL");
  const u = (await res.json()) as { public_url: string; upload_url: string; upload_headers: Record<string, string> };
  const put = await fetch(u.upload_url, { method: "PUT", headers: u.upload_headers, body: new Uint8Array(f.buf) });
  if (!put.ok) throw new Error(`Higgsfield upload ${put.status}`);
  await q(`INSERT INTO provider_uploads (sha, provider, url) VALUES ($1,'higgsfield',$2)
           ON CONFLICT (sha, provider) DO UPDATE SET url=excluded.url, created_at=now()`, [sha, u.public_url]);
  return u.public_url;
}

async function body(req: ClipRequest) {
  const m = MODELS[req.model];
  const images = req.imageShas.slice(0, m.maxImages);
  return {
    prompt: req.prompt, duration: Math.min(Math.max(Math.round(req.duration), 4), m.maxSeconds),
    aspect_ratio: req.aspect, resolution: req.resolution,
    image_urls: await Promise.all(images.map(publicUrl)),
    ...(req.audioSha ? { audio_urls: [await publicUrl(req.audioSha)] } : {}),
    generate_audio: true,
  };
}

/** Estimated cents for one clip. Asks Higgsfield when a key is set; otherwise uses the price list. */
export async function estimateCents(model: VideoModel, resolution: string, duration: number): Promise<number> {
  if (videoProvider() === "mock") return 0;
  return Math.round(100 * (USD_PER_S[model][resolution] ?? USD_PER_S[model]["720p"]) * duration * 10) / 10;
}

/** Submit one clip. Returns the provider's request id (mock clips are finished at once). */
export async function submitClip(req: ClipRequest): Promise<{ requestId: string; cents: number | null; mockVideo?: Buffer }> {
  if (videoProvider() === "mock") return { requestId: `mock-${Date.now()}`, cents: 0, mockVideo: await mockClip(req) };
  const b = await body(req);
  const cents = await estimateCents(req.model, req.resolution, b.duration);
  const res = await fetch(`${BASE}/bytedance/${req.model}/reference-to-video`, { method: "POST", headers: auth(), body: JSON.stringify(b) });
  if (!res.ok) await fail(res, "submit");
  const j = (await res.json()) as { request_id: string };
  return { requestId: j.request_id, cents };
}

export type ClipStatus = { state: "waiting" } | { state: "done"; video: Buffer } | { state: "failed"; error: string };

export async function clipStatus(requestId: string): Promise<ClipStatus> {
  const res = await fetch(`${BASE}/requests/${encodeURIComponent(requestId)}/status`, { headers: auth() });
  if (!res.ok) await fail(res, "status");
  const j = (await res.json()) as { status: string; video?: { url: string }; error?: string };
  if (j.status === "queued" || j.status === "in_progress") return { state: "waiting" };
  if (j.status === "completed" && j.video?.url) {
    for (let attempt = 1; ; attempt++) {
      try {
        const v = await fetch(j.video.url);
        if (!v.ok) throw new Error(`Higgsfield video download ${v.status}`);
        return { state: "done", video: Buffer.from(await v.arrayBuffer()) };
      } catch (err) {
        if (attempt >= 4) throw err;
        await new Promise((r) => setTimeout(r, 3000 * attempt));
      }
    }
  }
  if (j.status === "nsfw") return { state: "failed", error: "Higgsfield's safety check blocked this clip (not charged). It gives no reason. Common triggers: a child in frame with an adult in an undershirt or other revealing clothes, visible injury, or physical struggle. Change the outfit reference or the action, then generate again." };
  return { state: "failed", error: `Higgsfield: ${j.status}${j.error ? `, ${j.error}` : ""}` };
}

/** A labelled placeholder: the first raster reference (or a colour card) for the clip's length, with its dialogue stem. */
async function mockClip(req: ClipRequest): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "mock-clip-"));
  try {
    const [w, h] = req.aspect === "16:9" ? [960, 540] : [540, 960];
    const args: string[] = ["-y"];
    let img: string | null = null;
    for (const sha of req.imageShas) {
      const f = await readStored(sha);
      if (!/image\/(png|jpeg|webp)/.test(f.mime)) continue;
      img = path.join(dir, `ref.${f.mime.split("/")[1]}`);
      await writeFile(img, f.buf);
      break;
    }
    if (img) args.push("-loop", "1", "-i", img);
    else args.push("-f", "lavfi", "-i", `color=c=0x6b5b4b:s=${w}x${h}`);
    if (req.audioSha) {
      const a = await readStored(req.audioSha);
      const ap = path.join(dir, "stem.wav");
      await writeFile(ap, a.buf);
      args.push("-i", ap);
    } else args.push("-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo");
    const out = path.join(dir, "clip.mp4");
    // A slow push-in so a placeholder reads as moving picture.
    const vf = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},zoompan=z='min(zoom+0.0008,1.08)':d=1:s=${w}x${h}:fps=24,format=yuv420p`;
    args.push("-t", String(req.duration), "-vf", vf, "-r", "24", "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-shortest", out);
    await run("ffmpeg", args, { maxBuffer: 1 << 24 });
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
