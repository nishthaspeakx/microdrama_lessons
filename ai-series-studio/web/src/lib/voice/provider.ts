/**
 * Voices behind one small interface. ElevenLabs (docs read 2026-11-26):
 * - POST /v1/text-to-voice/design {voice_description, text (100–1000 chars), model_id,
 *   reference_audio_base64 (eleven_ttv_v3 only)} → previews[{audio_base_64, generated_voice_id, media_type}]
 * - POST /v1/text-to-voice {voice_name, voice_description, generated_voice_id} → voice_id
 * - GET  /v1/voices/{voice_id} → name, category, labels, description
 * - POST /v1/text-to-speech/{voice_id}?output_format=mp3_44100_128 {text, model_id, voice_settings} → audio bytes;
 *   the "character-cost" response header says what it cost
 * VOICE_PROVIDER=mock gives labelled test tones for trying the flow at no cost.
 */
const BASE = "https://api.elevenlabs.io";
export const DESIGN_MODEL = process.env.ELEVENLABS_DESIGN_MODEL || "eleven_ttv_v3";
export const TTS_MODEL = process.env.ELEVENLABS_TTS_MODEL || "eleven_v4";
// Roughly $0.08 per 1,000 characters on the API price list; plan credits vary.
const CENTS_PER_CHAR = 0.008;

export type Preview = { audio: Buffer; mime: string; generatedVoiceId: string };
export type VoiceInfo = { name: string; category: string; description: string | null; labels: Record<string, string> };

export function voiceProvider(): "elevenlabs" | "mock" | "none" {
  if (process.env.VOICE_PROVIDER === "mock") return "mock";
  return process.env.ELEVENLABS_API_KEY ? "elevenlabs" : "none";
}

function headers() {
  return { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json" };
}

async function fail(res: Response, what: string): Promise<never> {
  const text = await res.text();
  let msg = text.slice(0, 300);
  try {
    const j = JSON.parse(text);
    msg = j.detail?.message ?? (typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail ?? j)).slice(0, 300);
  } catch {}
  throw new Error(`ElevenLabs ${what} ${res.status}: ${msg}`);
}

export async function designVoices(description: string, text: string, referenceAudio?: Buffer): Promise<{ previews: Preview[]; cents: number }> {
  if (voiceProvider() === "mock") return mockDesign(text);
  const body: Record<string, unknown> = { voice_description: description, text, model_id: DESIGN_MODEL };
  if (referenceAudio && DESIGN_MODEL === "eleven_ttv_v3") body.reference_audio_base64 = referenceAudio.toString("base64");
  const res = await fetch(`${BASE}/v1/text-to-voice/design?output_format=mp3_44100_128`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) await fail(res, "voice design");
  const j = (await res.json()) as { previews: { audio_base_64: string; generated_voice_id: string; media_type: string }[] };
  const cost = Number(res.headers.get("character-cost") ?? text.length);
  return {
    previews: j.previews.map((p) => ({ audio: Buffer.from(p.audio_base_64, "base64"), mime: p.media_type || "audio/mpeg", generatedVoiceId: p.generated_voice_id })),
    cents: cost * CENTS_PER_CHAR,
  };
}

export async function saveDesignedVoice(generatedVoiceId: string, name: string, description: string): Promise<string> {
  if (voiceProvider() === "mock") return `mock-voice-${generatedVoiceId.slice(-8)}`;
  const res = await fetch(`${BASE}/v1/text-to-voice`, {
    method: "POST", headers: headers(),
    body: JSON.stringify({ voice_name: name, voice_description: description, generated_voice_id: generatedVoiceId }),
  });
  if (!res.ok) await fail(res, "save voice");
  return ((await res.json()) as { voice_id: string }).voice_id;
}

export async function getVoice(voiceId: string): Promise<VoiceInfo> {
  if (voiceProvider() === "mock") return { name: `Test voice ${voiceId.slice(0, 6)}`, category: "mock", description: null, labels: {} };
  const res = await fetch(`${BASE}/v1/voices/${encodeURIComponent(voiceId)}`, { headers: headers() });
  if (!res.ok) await fail(res, "voice lookup");
  const j = (await res.json()) as VoiceInfo;
  return { name: j.name, category: j.category, description: j.description ?? null, labels: j.labels ?? {} };
}

export async function speak(voiceId: string, text: string, settings: Record<string, number | boolean> = {}): Promise<{ audio: Buffer; mime: string; cents: number }> {
  if (voiceProvider() === "mock") return { audio: tone(voiceId, 2.2), mime: "audio/wav", cents: 0 };
  const res = await fetch(`${BASE}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: "POST", headers: headers(),
    body: JSON.stringify({ text, model_id: TTS_MODEL, ...(Object.keys(settings).length ? { voice_settings: settings } : {}) }),
  });
  if (!res.ok) await fail(res, "speech");
  const cost = Number(res.headers.get("character-cost") ?? text.length);
  return { audio: Buffer.from(await res.arrayBuffer()), mime: "audio/mpeg", cents: cost * CENTS_PER_CHAR };
}

// ---------- voice library ----------

export type LibraryVoice = {
  voice_id: string; public_owner_id: string; name: string; gender: string; age: string; accent: string;
  descriptive: string | null; use_case: string | null; preview_url: string | null; cloned_by_count: number;
};

/** Search the ElevenLabs voice library (free). */
export async function searchLibrary(opts: { gender?: string; age?: string; language?: string; search?: string }): Promise<LibraryVoice[]> {
  const params = new URLSearchParams({ page_size: "60", language: opts.language ?? "hi" });
  if (opts.gender) params.set("gender", opts.gender);
  if (opts.age) params.set("age", opts.age);
  if (opts.search) params.set("search", opts.search);
  const res = await fetch(`${BASE}/v1/shared-voices?${params}`, { headers: headers() });
  if (!res.ok) await fail(res, "voice library");
  const j = (await res.json()) as { voices: LibraryVoice[] };
  return j.voices.sort((a, b) => (b.cloned_by_count ?? 0) - (a.cloned_by_count ?? 0));
}

/** Add a library voice to the account so it can speak. Library voices do not use cloned-voice slots. */
export async function addLibraryVoice(publicOwnerId: string, voiceId: string, name: string): Promise<string> {
  const res = await fetch(`${BASE}/v1/voices/add/${encodeURIComponent(publicOwnerId)}/${encodeURIComponent(voiceId)}`, {
    method: "POST", headers: headers(), body: JSON.stringify({ new_name: name.slice(0, 100) }),
  });
  if (!res.ok) await fail(res, "add library voice");
  return ((await res.json()) as { voice_id: string }).voice_id;
}

// ---------- test mode ----------

/** A short sine tone as WAV, pitch derived from the seed, so candidates sound different. */
function tone(seed: string, seconds: number): Buffer {
  const rate = 16000, n = Math.floor(rate * seconds);
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const freq = 180 + (h % 260);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / 800, (n - i) / 800);
    data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 8000 * env), i * 2);
  }
  const head = Buffer.alloc(44);
  head.write("RIFF", 0); head.writeUInt32LE(36 + data.length, 4); head.write("WAVE", 8); head.write("fmt ", 12);
  head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22); head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34); head.write("data", 36); head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

async function mockDesign(text: string) {
  await new Promise((r) => setTimeout(r, 500));
  const stamp = Date.now().toString(36);
  return {
    previews: [0, 1, 2].map((i) => ({ audio: tone(`${text}${stamp}${i}`, 2.5), mime: "audio/wav", generatedVoiceId: `mockgen_${stamp}_${i}` })),
    cents: 0,
  };
}

// ---------- sound effects ----------

/**
 * A short sound effect from a text description (POST /v1/sound-generation {text, duration_seconds 0.5–30,
 * prompt_influence}). Used by review edits like "add the clink of a steel plate at 0:06".
 */
export async function soundEffect(text: string, seconds: number): Promise<{ audio: Buffer; mime: string; cents: number }> {
  const dur = Math.min(Math.max(seconds, 0.5), 30);
  if (voiceProvider() === "mock") return { audio: tone(`sfx-${text}`, dur), mime: "audio/wav", cents: 0 };
  const res = await fetch(`${BASE}/v1/sound-generation?output_format=mp3_44100_128`, {
    method: "POST", headers: headers(), body: JSON.stringify({ text, duration_seconds: dur, prompt_influence: 0.5 }),
  });
  if (!res.ok) await fail(res, "sound effect");
  const cost = Number(res.headers.get("character-cost") ?? 0);
  return { audio: Buffer.from(await res.arrayBuffer()), mime: "audio/mpeg", cents: cost * CENTS_PER_CHAR };
}
