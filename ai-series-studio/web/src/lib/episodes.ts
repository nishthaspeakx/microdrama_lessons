/**
 * Step 4: one complete episode. Audio first:
 * 1. Claude writes the screenplay (Devanagari, English, Roman Hinglish, linked by line id) and splits each
 *    scene into clips: one video generation of 4–15 s holding one to three timed shots.
 * 2. Every line is recorded with its speaker's locked voice and measured.
 * 3. Each clip gets a dialogue stem cut to its length; the picture is generated against the stem with the
 *    approved reference images (Higgsfield Seedance, reference-to-video).
 * 4. Assembly normalises the clips, lays our dialogue over each clip's own ambience, burns Devanagari
 *    subtitles and records scene markers.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { q, one, tx, logEvent } from "./db";
import { enqueue } from "./jobs";
import { runStructured } from "./llm";
import { readStored, storeFile } from "./storage";
import { applyPronunciations } from "./voices";
import { speak } from "./voice/provider";
import { MODELS, videoProvider, submitClip, clipStatus, estimateCents, type VideoModel } from "./video/provider";
import type { Intake } from "./intakeSchema";

const run = promisify(execFile);
const VIDEO_BUDGET_CENTS = Number(process.env.PROJECT_VIDEO_BUDGET_USD ?? 40) * 100;

export type Line = { id: string; speaker: string; devanagari: string; english: string; roman: string; direction: string };
export type Scene = { n: number; heading: string; location_key: string; summary: string; duration_s: number; lines: Line[] };
export type Screenplay = { scenes: Scene[]; notes: string[] };
/**
 * dialogue: "recorded" = our locked-voice recordings, with the clip's own speech silenced under each line
 * (Seedance re-voices the audio it is given, so keeping both would double every line); "clip" = the video
 * model's own soundtrack, whose speech matches the mouths exactly but is its re-voicing of our recording.
 */
export type Settings = { model: VideoModel; resolution: string; aspect_ratio: string; fps: number; width: number; height: number; subtitles: boolean; dialogue?: "recorded" | "clip" };
export type Episode = {
  id: string; project_id: string; number: number; title: string; status: string; source: string; screenplay: Screenplay;
  settings: Settings; bible_version: number | null; cut_sha: string | null; cut_srt_sha: string | null; error: string | null;
};
export type Clip = {
  id: string; episode_id: string; scene_n: number; n: number; duration_s: number;
  shots: { t0: number; t1: number; framing: string; action: string }[]; lines: { id: string; at: number }[];
  refs: string[]; prompt: string; sound: string; transition: string; status: string; current_take_id: string | null; error: string | null;
};

// ---------- Which episode, and its settings ----------

const MADE = /do not regenerate|already (made|produced|finished)|finished (cut|video)|made and approved|approved first episode/i;

/** The first episode with a script that is not marked as already made. */
export function nextEpisodeNumber(s: Intake) {
  const eps = [...s.episodes].sort((a, b) => a.number - b.number);
  const open = eps.filter((e) => !MADE.test(`${e.script.note ?? ""}`));
  return (open.find((e) => e.script.status === "screenplay") ?? open[0] ?? eps[0])?.number ?? 1;
}

function defaultSettings(s: Intake): Settings {
  const aspect = s.series.format.aspect_ratio === "16:9" ? "16:9" : "9:16";
  const [width, height] = aspect === "16:9" ? [1920, 1080] : [1080, 1920];
  return { model: "seedance-2.0", resolution: "480p", aspect_ratio: aspect, fps: s.series.format.fps || 24, width, height, subtitles: true };
}

export async function startEpisode(projectId: string, number?: number) {
  const row = await one<{ summary: Intake }>("SELECT summary FROM intake WHERE project_id=$1", [projectId]);
  if (!row) throw new Error("No step 1 summary yet.");
  const n = number ?? nextEpisodeNumber(row.summary);
  const ep = row.summary.episodes.find((e) => e.number === n);
  if (!ep) throw new Error(`Episode ${n} is not in the summary.`);
  const bible = await one<{ version: number }>("SELECT MAX(version) AS version FROM bible_versions WHERE project_id=$1", [projectId]);
  const e = await one<{ id: string }>(
    `INSERT INTO episodes (project_id, number, title, settings, bible_version, status) VALUES ($1,$2,$3,$4,$5,'planning')
     ON CONFLICT (project_id, number) DO UPDATE SET status='planning', error=NULL, bible_version=excluded.bible_version, updated_at=now()
     RETURNING id`,
    [projectId, n, ep.title, JSON.stringify(defaultSettings(row.summary)), bible?.version ?? null]);
  await enqueue("episodes.plan", projectId, { episodeId: e!.id });
  return e!.id;
}

// ---------- Planning ----------

const str = { type: "string" } as const;
const num = { type: "number" } as const;
const obj = (properties: Record<string, object>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });

const SCREENPLAY_SCHEMA = obj({
  source: str, title: str, notes: { type: "array", items: str },
  scenes: { type: "array", items: obj({
    n: { type: "integer" }, heading: str, location_key: str, summary: str, duration_s: num,
    lines: { type: "array", items: obj({ id: str, speaker: str, devanagari: str, english: str, roman: str, direction: str }) },
  }) },
});

const CLIPS_SCHEMA = obj({
  checks: { type: "array", items: str },
  clips: { type: "array", items: obj({
    scene_n: { type: "integer" }, duration_s: { type: "integer" },
    shots: { type: "array", items: obj({ t0: num, t1: num, framing: str, action: str }) },
    lines: { type: "array", items: obj({ id: str, at: num }) },
    refs: { type: "array", items: str }, prompt: str, sound: str, transition: str,
  }) },
});

export const SCREENPLAY_SYSTEM = `# episode_screenplay v1 (2026-11-26)

You prepare the screenplay of one episode of a vertical Hindi and Hinglish microdrama for production.

The input has the series summary, this episode's entry, the source sections for this episode (screenplay, timed camera plans, sample prompts, notes), notes on how the previous episode ended, the speaking parts (voice role keys) and the approved looks, outfits, places and props (keys).

Return:
- source: "sources" when the sources contain this episode's scenes and dialogue, "draft" when you had to write them. A draft must also say so in notes.
- title: the episode title exactly as in the sources.
- scenes: in story order, numbered from 1. heading: like the source heading (INT. or EXT., place, time, year). location_key: the best-matching location key from the list, or "". summary: one or two sentences. duration_s: the scene's target length from the sources' timing; the scenes add up to the episode runtime.
- lines: every spoken line in order, ids "S{scene}L{n}" (S1L1, S1L2…). speaker: the voice role key of whoever speaks, or "" when no role fits (a crowd, an unnamed voice). devanagari: the line exactly as the screenplay gives it: Hindi in Devanagari, English words left in Latin script as written. english: a natural English translation. roman: the same line in Roman Hinglish. direction: a short delivery note (whispered, calling across the yard) or "".
- Never reword dialogue the sources give. When a line is described but not quoted (for example "he calls out to her"), write a short line that fits and add a note that it needs the creator's approval.
- notes: what the creator should check before generation: unquoted lines, places where the screenplay and the camera plan disagree, timing that does not fit.`;

export function clipsSystem(model: VideoModel) {
  const max = MODELS[model].maxSeconds;
  return `# episode_clips v1 (2026-11-26)

You turn an approved screenplay into video generation clips for ${MODELS[model].label}, a reference-to-video model that also takes the recorded dialogue as audio.

Rules:
- A clip is one generation of 4 to ${max} whole seconds holding one to three shots, timed inside it: t0 and t1 are seconds from the clip start, back to back, the last ending at duration_s. Cuts between shots happen inside the clip; the edit joins clips with a cut.
- Clips follow the scenes in order and never span two scenes. Each scene's clips add up to about its duration_s.
- Where the sources give a timed camera plan, follow its framing, lens feel, movement and light, compressed into clips.
- lines: every screenplay line appears in exactly one clip, with at = the second, from the clip start, where it begins. Leave room: Hindi speech runs about 2.5 words a second, so a line of W words needs W/2.5 + 0.4 seconds before the next line or the end of the clip. The first line starts at 0.3 s or later. The speaker is on screen when they speak unless the screenplay says otherwise.
- refs: keys of what is visible, most important first, at most 6: for each person their character key and the outfit key they wear in this scene, then the location key, then key props. Use only keys from the list.
- prompt: English, present tense, photoreal and cinematic, written for the video model. One sentence for the place and light first. Then each shot as "Shot 1 (0–3 s): framing; action; camera." Name people by name and give their age and clothes in a few words so the model matches the references. Say who speaks in each shot and that their lips move with their line. Keep screen direction consistent from clip to clip. No on-screen text, captions or logos. Do not write out the dialogue; it is added from the recordings.
- Anyone protected (a child or a minor) is fully clothed exactly as in their outfit reference, no injury is shown, and danger comes through reaction and suggestion rather than harm.
- When a child or minor is in frame, every adult in the same clip wears full upper-body clothing (a shirt or kurta, not a vest or undershirt alone): the video model's safety check blocks those clips. If the story puts an adult in an undershirt, keep the child out of that clip, or flag it in checks.
- sound: ambience and effects with their seconds. No music unless the sources ask for it.
- transition: how this clip joins the next: "cut", "match cut: …", "cut to black".

checks: problems worth fixing before paying for video: a scene that needs more time than the sources allow, an action a video model is likely to get wrong, a person with no approved look.`;
}

async function planInput(projectId: string, number: number) {
  const row = (await one<{ summary: Intake }>("SELECT summary FROM intake WHERE project_id=$1", [projectId]))!;
  const s = row.summary;
  const ep = s.episodes.find((e) => e.number === number)!;
  const prev = s.episodes.find((e) => e.number === number - 1);
  const refs = [...new Set([...(ep.script.sections ?? []), ...(ep.sources ?? [])])];
  const sections = await q<{ ref: string; kind: string; heading: string; text: string }>(
    "SELECT ref, kind, heading, text FROM source_sections WHERE project_id=$1 AND ref = ANY($2) ORDER BY ref", [projectId, refs]);
  const roles = await q<{ key: string; name: string; locked: boolean }>(
    "SELECT key, name, status='locked' AS locked FROM voice_roles WHERE project_id=$1 ORDER BY sort", [projectId]);
  const items = await q<{ key: string; category: string; name: string; description: string; parent_key: string | null; episodes: number[]; protected: boolean }>(
    `SELECT key, category, name, left(description, 240) AS description, parent_key, episodes, protected FROM visual_items
     WHERE project_id=$1 AND approved_version_id IS NOT NULL ORDER BY sort`, [projectId]);
  return {
    episode: ep,
    input: JSON.stringify({
      series: { title: s.series.title, logline: s.series.logline, setting: s.series.setting, era: s.series.era, language: s.series.language,
        dialogue_script: s.series.dialogue_script, tone: s.series.tone, format: s.series.format },
      episode: ep, previous_episode: prev ? { number: prev.number, title: prev.title, ends_on: prev.ends_on } : null,
      typed_brief_use: s.typed_brief_use,
      sources: sections.map((x) => `[${x.ref} · ${x.kind}] ${x.heading}\n${x.text}`).join("\n\n"),
      speaking_parts: roles, looks_places_props: items,
    }),
    itemKeys: new Set(items.map((i) => i.key)), roleKeys: new Set(roles.map((r) => r.key)),
  };
}

export async function planEpisode(episodeId: string) {
  const e = (await one<Episode>("SELECT * FROM episodes WHERE id=$1", [episodeId]))!;
  try {
    const { input, itemKeys, roleKeys } = await planInput(e.project_id, e.number);
    const sp = await runStructured<Screenplay & { source: string; title: string; scenes: Scene[] }>({
      role: "episode_screenplay", system: SCREENPLAY_SYSTEM, input, schema: SCREENPLAY_SCHEMA, projectId: e.project_id,
      instruction: `Prepare the screenplay of Episode ${e.number}.`,
    });
    const scenes = sp.data.scenes.map((sc, i) => ({
      ...sc, n: i + 1, location_key: itemKeys.has(sc.location_key) ? sc.location_key : "",
      lines: sc.lines.map((l, j) => ({ ...l, id: `S${i + 1}L${j + 1}`, speaker: roleKeys.has(l.speaker) ? l.speaker : "" })),
    }));
    const screenplay: Screenplay = { scenes, notes: sp.data.notes };
    const cl = await runStructured<{ checks: string[]; clips: Omit<Clip, "id" | "episode_id" | "n" | "status" | "current_take_id" | "error">[] }>({
      role: "episode_clips", system: clipsSystem(e.settings.model), input, schema: CLIPS_SCHEMA, projectId: e.project_id,
      instruction: `Split Episode ${e.number} into clips. The approved screenplay, with the line ids to use:\n${JSON.stringify(scenes)}`,
    });
    const max = MODELS[e.settings.model].maxSeconds;
    const lineIds = new Set(scenes.flatMap((s) => s.lines.map((l) => l.id)));
    const clips = cl.data.clips
      .filter((c) => scenes.some((s) => s.n === c.scene_n))
      .sort((a, b) => a.scene_n - b.scene_n)
      .map((c) => ({ ...c, duration_s: Math.min(Math.max(Math.round(c.duration_s), 4), max),
        lines: c.lines.filter((l) => lineIds.has(l.id)), refs: c.refs.filter((k) => itemKeys.has(k)).slice(0, 6) }));
    const placed = new Set(clips.flatMap((c) => c.lines.map((l) => l.id)));
    const missing = [...lineIds].filter((id) => !placed.has(id));
    screenplay.notes = [...screenplay.notes, ...cl.data.checks,
      ...(missing.length ? [`Lines not placed in any clip: ${missing.join(", ")}. Add them to a clip before generating.`] : [])];
    await tx(async (c) => {
      await c.query("DELETE FROM episode_clips WHERE episode_id=$1", [episodeId]);
      for (const [i, k] of clips.entries()) {
        await c.query(
          `INSERT INTO episode_clips (episode_id, scene_n, n, duration_s, shots, lines, refs, prompt, sound, transition)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [episodeId, k.scene_n, i + 1, k.duration_s, JSON.stringify(k.shots), JSON.stringify(k.lines), JSON.stringify(k.refs), k.prompt, k.sound, k.transition]);
      }
      await c.query("UPDATE episodes SET screenplay=$2, source=$3, title=COALESCE(NULLIF($4,''), title), status='ready', error=NULL, updated_at=now() WHERE id=$1",
        [episodeId, JSON.stringify(screenplay), sp.data.source === "draft" ? "draft" : "sources", sp.data.title]);
    });
    await logEvent(e.project_id, "episode.planned", { episode: e.number, scenes: scenes.length, clips: clips.length });
  } catch (err) {
    await q("UPDATE episodes SET status='plan_failed', error=$2, updated_at=now() WHERE id=$1", [episodeId, (err as Error).message.slice(0, 800)]);
    throw err;
  }
}

// ---------- Lines ----------

export function allLines(sp: Screenplay) {
  return (sp.scenes ?? []).flatMap((s) => s.lines.map((l) => ({ ...l, scene: s.n })));
}

/** Rough seconds for a line before it is recorded: about 2.5 words a second. */
export function estSeconds(text: string) {
  return Math.round((text.trim().split(/\s+/).length / 2.5 + 0.3) * 10) / 10;
}

async function lockedVoices(projectId: string) {
  const rows = await q<{ key: string; voice_id: string }>(
    `SELECT r.key, c.provider_voice_id AS voice_id FROM voice_roles r JOIN voice_candidates c ON c.id=r.locked_candidate_id
     WHERE r.project_id=$1 AND r.status='locked'`, [projectId]);
  return new Map(rows.map((r) => [r.key, r.voice_id]));
}

async function probeSeconds(file: string) {
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]);
  return Number(stdout.trim());
}

async function withTmp<T>(fn: (dir: string) => Promise<T>) {
  const dir = await mkdtemp(path.join(tmpdir(), "episode-"));
  try { return await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

/** Record one line with its speaker's locked voice. Reuses the recording when text and voice are unchanged. */
export async function recordLine(e: Episode, line: Line) {
  if (!line.speaker) return null;
  const voice = (await lockedVoices(e.project_id)).get(line.speaker);
  if (!voice) throw Object.assign(new Error(`${line.id}: ${line.speaker} has no locked voice. Lock one in step 3.`), { retryable: false });
  const spoken = await applyPronunciations(e.project_id, line.devanagari);
  const have = await one<{ audio_sha: string; duration_s: string; spoken_text: string; voice_id: string; status: string }>(
    "SELECT * FROM episode_lines WHERE episode_id=$1 AND line_id=$2", [e.id, line.id]);
  if (have?.status === "ready" && have.spoken_text === spoken && have.voice_id === voice) return { sha: have.audio_sha, seconds: Number(have.duration_s) };
  await q(`INSERT INTO episode_lines (episode_id, line_id, role_key, spoken_text, voice_id, status) VALUES ($1,$2,$3,$4,$5,'recording')
           ON CONFLICT (episode_id, line_id) DO UPDATE SET role_key=excluded.role_key, spoken_text=excluded.spoken_text, voice_id=excluded.voice_id,
             status='recording', error=NULL, updated_at=now()`, [e.id, line.id, line.speaker, spoken, voice]);
  try {
    const out = await speak(voice, spoken);
    const sha = await storeFile(out.audio, out.mime, "generated");
    const seconds = await withTmp(async (dir) => {
      const f = path.join(dir, out.mime === "audio/wav" ? "l.wav" : "l.mp3");
      await writeFile(f, out.audio);
      return probeSeconds(f);
    });
    await q("UPDATE episode_lines SET audio_sha=$3, duration_s=$4, status='ready', cost_cents=cost_cents+$5, updated_at=now() WHERE episode_id=$1 AND line_id=$2",
      [e.id, line.id, sha, seconds, out.cents]);
    if (out.cents) await q("INSERT INTO spend (project_id, category, provider, model, cents) VALUES ($1,'voice','elevenlabs','tts',$2)", [e.project_id, out.cents]);
    return { sha, seconds };
  } catch (err) {
    await q("UPDATE episode_lines SET status='failed', error=$3, updated_at=now() WHERE episode_id=$1 AND line_id=$2", [e.id, line.id, (err as Error).message.slice(0, 500)]);
    throw err;
  }
}

export async function recordAllLines(episodeId: string) {
  const e = (await one<Episode>("SELECT * FROM episodes WHERE id=$1", [episodeId]))!;
  const errors: string[] = [];
  for (const l of allLines(e.screenplay)) {
    try { await recordLine(e, l); } catch (err) { errors.push((err as Error).message); }
  }
  if (errors.length) throw Object.assign(new Error(errors.slice(0, 3).join(" · ")), { retryable: false });
}

/** A WAV as long as the clip: silence, each recorded line at its start time. */
async function buildStem(parts: { sha: string; at: number }[], seconds: number): Promise<string> {
  return withTmp(async (dir) => {
    const args = ["-y", "-f", "lavfi", "-t", String(seconds), "-i", "anullsrc=r=48000:cl=stereo"];
    const filters: string[] = [];
    for (const [i, p] of parts.entries()) {
      const f = await readStored(p.sha);
      const file = path.join(dir, `l${i}${f.mime === "audio/wav" ? ".wav" : ".mp3"}`);
      await writeFile(file, f.buf);
      args.push("-i", file);
      filters.push(`[${i + 1}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(p.at * 1000)}:all=1[a${i}]`);
    }
    const mix = `[0:a]${parts.map((_, i) => `[a${i}]`).join("")}amix=inputs=${parts.length + 1}:duration=first:normalize=0[out]`;
    const out = path.join(dir, "stem.wav");
    args.push("-filter_complex", [...filters, mix].join(";"), "-map", "[out]", "-c:a", "pcm_s16le", out);
    await run("ffmpeg", args, { maxBuffer: 1 << 24 });
    return storeFile(await readFile(out), "audio/wav", "derived");
  });
}

// ---------- References ----------

type Slot = { sha: string; label: string };

/** Approved images for the clip's refs, in slot order: faces, then outfits, then places, then props. */
async function referenceSlots(projectId: string, keys: string[], maxImages: number): Promise<Slot[]> {
  if (!keys.length) return [];
  const items = await q<{ key: string; category: string; name: string; parent_key: string | null; version_id: string }>(
    "SELECT key, category, name, parent_key, approved_version_id AS version_id FROM visual_items WHERE project_id=$1 AND key = ANY($2) AND approved_version_id IS NOT NULL",
    [projectId, keys]);
  const byKey = new Map(items.map((i) => [i.key, i]));
  const img = async (versionId: string, views: string[]) => {
    const r = await one<{ file_sha: string; view: string }>(
      `SELECT file_sha, view FROM visual_images WHERE version_id=$1 AND view = ANY($2)
       ORDER BY array_position($2::text[], view) LIMIT 1`, [versionId, [...views, "reference"]]);
    return r?.file_sha ?? null;
  };
  const order = { character: 0, wardrobe: 1, location: 2, prop: 3 } as Record<string, number>;
  const sorted = keys.map((k) => byKey.get(k)).filter(Boolean).sort((a, b) => order[a!.category] - order[b!.category]);
  const slots: Slot[] = [];
  const wearing = new Set(sorted.filter((i) => i!.category === "wardrobe").map((i) => i!.parent_key));
  for (const it of sorted) {
    const i = it!;
    if (i.category === "character") {
      const face = await img(i.version_id, ["face", "full_front"]);
      if (face) slots.push({ sha: face, label: `${i.name}: face` });
      if (!wearing.has(i.key)) {
        const body = await img(i.version_id, ["full_front"]);
        if (body && body !== face) slots.push({ sha: body, label: `${i.name}: body and clothes` });
      }
    } else if (i.category === "wardrobe") {
      const o = await img(i.version_id, ["outfit"]);
      if (o) slots.push({ sha: o, label: `${byKey.get(i.parent_key ?? "")?.name ?? "the person"} wearing ${i.name}` });
    } else if (i.category === "location") {
      const l = await img(i.version_id, ["establishing", "angle"]);
      if (l) slots.push({ sha: l, label: `the place: ${i.name}` });
    } else {
      const p = await img(i.version_id, ["three_quarter", "detail_scale"]);
      if (p) slots.push({ sha: p, label: `${i.name}` });
    }
  }
  return slots.slice(0, maxImages);
}

/**
 * A person listed without their outfit would be drawn in whatever their character image wears (Meera came out
 * in a frock instead of her uniform). Add the outfit that person wears in the other clips of the same scene.
 */
async function withSceneOutfits(e: Episode, c: Clip) {
  const refs = [...c.refs];
  const items = await q<{ key: string; category: string; parent_key: string | null }>(
    "SELECT key, category, parent_key FROM visual_items WHERE project_id=$1 AND approved_version_id IS NOT NULL", [e.project_id]);
  const byKey = new Map(items.map((i) => [i.key, i]));
  const sceneRefs = (await q<{ refs: string[] }>("SELECT refs FROM episode_clips WHERE episode_id=$1 AND scene_n=$2 AND id<>$3", [e.id, c.scene_n, c.id]))
    .flatMap((r) => r.refs);
  for (const k of c.refs) {
    if (byKey.get(k)?.category !== "character") continue;
    if (refs.some((r) => byKey.get(r)?.category === "wardrobe" && byKey.get(r)?.parent_key === k)) continue;
    const worn = sceneRefs.find((r) => byKey.get(r)?.category === "wardrobe" && byKey.get(r)?.parent_key === k);
    if (worn) refs.splice(refs.indexOf(k) + 1, 0, worn);
  }
  return refs;
}

// ---------- Generating clips ----------

export async function videoSpentCents(projectId: string) {
  return Number((await one<{ c: string }>("SELECT COALESCE(SUM(cents),0) AS c FROM spend WHERE project_id=$1 AND category='video'", [projectId]))!.c);
}

/** Queue a new take for each clip. Earlier takes are kept. */
export async function queueTakes(episodeId: string, clipIds: string[]) {
  const e = (await one<Episode>("SELECT * FROM episodes WHERE id=$1", [episodeId]))!;
  const clips = await q<Clip>("SELECT * FROM episode_clips WHERE episode_id=$1 AND id = ANY($2) ORDER BY n", [episodeId, clipIds]);
  const busy = clips.filter((c) => c.status === "queued" || c.status === "generating");
  if (busy.length === clips.length && clips.length) throw new Error("Those clips are already being made.");
  let est = 0;
  for (const c of clips) est += await estimateCents(e.settings.model, e.settings.resolution, c.duration_s);
  const spent = await videoSpentCents(e.project_id);
  if (spent + est > VIDEO_BUDGET_CENTS)
    throw new Error(`This would take video spend to $${((spent + est) / 100).toFixed(2)}, over the project's $${(VIDEO_BUDGET_CENTS / 100).toFixed(0)} video budget (PROJECT_VIDEO_BUDGET_USD).`);
  for (const c of clips) {
    if (c.status === "queued" || c.status === "generating") continue;
    // If the last attempt reached Higgsfield and failed only on our side (a dropped connection), fetch that
    // result instead of paying for a new generation.
    const last = await one<{ id: string; request_id: string | null; status: string; error: string | null }>(
      "SELECT id, request_id, status, error FROM episode_takes WHERE clip_id=$1 ORDER BY n DESC LIMIT 1", [c.id]);
    if (last?.status === "failed" && last.request_id && !last.request_id.startsWith("mock") && !/^Higgsfield/.test(last.error ?? "")) {
      await q("UPDATE episode_takes SET status='submitted', error=NULL, finished_at=NULL WHERE id=$1", [last.id]);
      await q("UPDATE episode_clips SET status='queued', error=NULL WHERE id=$1", [c.id]);
      await enqueue("episodes.take", e.project_id, { takeId: last.id });
      continue;
    }
    const t = await one<{ id: string }>(
      `INSERT INTO episode_takes (clip_id, n, provider, model, resolution, duration_s, prompt, est_cents)
       VALUES ($1, (SELECT COALESCE(MAX(n),0)+1 FROM episode_takes WHERE clip_id=$1), $2, $3, $4, $5, '', $6) RETURNING id`,
      [c.id, videoProvider(), e.settings.model, e.settings.resolution, c.duration_s, await estimateCents(e.settings.model, e.settings.resolution, c.duration_s)]);
    await q("UPDATE episode_clips SET status='queued', error=NULL WHERE id=$1", [c.id]);
    await enqueue("episodes.take", e.project_id, { takeId: t!.id });
  }
  await q("UPDATE episodes SET status='generating', updated_at=now() WHERE id=$1 AND status IN ('ready','assembled')", [episodeId]);
  return { estCents: est };
}

function composePrompt(c: Clip, slots: Slot[], timed: { id: string; start: number; end: number; who: string; text: string }[], aspect: string) {
  const refs = slots.length ? `References: ${slots.map((s, i) => `@image${i + 1} = ${s.label}`).join("; ")}. Match every face, outfit, place and object to its reference exactly in every shot.\n\n` : "";
  const dialogue = timed.length
    ? `\n\nDialogue, lip-sync follows @audio1 verbatim: ${timed.map((t) => `${t.who}, ${t.start.toFixed(1)}–${t.end.toFixed(1)} s: "${t.text}"`).join("; ")}. Only the person speaking moves their lips.`
    : "\n\nNo one speaks in this clip.";
  const shots = c.shots.length
    ? `\n\nShot plan, follow these timings (if anything above disagrees, this wins): ${c.shots.map((s, i) => `Shot ${i + 1} (${s.t0}–${s.t1} s): ${s.framing ? `${s.framing.replace(/\.$/, "")}. ` : ""}${s.action}`).join(" ")}`
    : "";
  const sound = c.sound ? `\n\nSound: ${c.sound.trim().replace(/\.+$/, "")}.` : "";
  return `${refs}${c.prompt}${shots}${dialogue}${sound}\n\nVertical ${aspect} frame, photoreal, natural skin texture, stable faces. No on-screen text, subtitles or logos.`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Make one take: record its lines, build the stem, submit, then poll. Resumes polling after a restart. */
export async function runTake(takeId: string, lastAttempt = false) {
  const t = (await one<{ id: string; clip_id: string; request_id: string | null; status: string; est_cents: string; duration_s: number; model: VideoModel; resolution: string }>(
    "SELECT * FROM episode_takes WHERE id=$1", [takeId]))!;
  const c = (await one<Clip>("SELECT * FROM episode_clips WHERE id=$1", [t.clip_id]))!;
  const e = (await one<Episode>("SELECT * FROM episodes WHERE id=$1", [c.episode_id]))!;
  const failTake = async (msg: string) => {
    await q("UPDATE episode_takes SET status='failed', error=$2, finished_at=now() WHERE id=$1", [takeId, msg.slice(0, 800)]);
    await q("UPDATE episode_clips SET status=CASE WHEN current_take_id IS NULL THEN 'failed' ELSE 'ready' END, error=$2 WHERE id=$1", [c.id, msg.slice(0, 800)]);
  };
  try {
    await q("UPDATE episode_clips SET status='generating', error=NULL WHERE id=$1", [c.id]);
    if (!t.request_id) {
      // 1. Record and place the dialogue.
      const lines = new Map(allLines(e.screenplay).map((l) => [l.id, l]));
      const roles = new Map((await q<{ key: string; name: string }>("SELECT key, name FROM voice_roles WHERE project_id=$1", [e.project_id])).map((r) => [r.key, r.name]));
      const parts: { sha: string; at: number }[] = [];
      const timed: { id: string; start: number; end: number; who: string; text: string }[] = [];
      for (const cl of [...c.lines].sort((a, b) => a.at - b.at)) {
        const l = lines.get(cl.id);
        if (!l) continue;
        const rec = await recordLine(e, l);
        if (!rec) continue;
        // Never let two recorded lines overlap: a line starts at least 0.15 s after the previous one ends.
        const prevEnd = timed.length ? timed[timed.length - 1].end : 0;
        const start = Math.round(Math.max(cl.at, timed.length ? prevEnd + 0.15 : 0) * 100) / 100;
        parts.push({ sha: rec.sha, at: start });
        timed.push({ id: l.id, start, end: start + rec.seconds, who: (roles.get(l.speaker) ?? l.speaker).replace(/ (at|in) .*$/, ""), text: l.devanagari });
      }
      const max = MODELS[t.model].maxSeconds;
      const need = Math.ceil(Math.max(0, ...timed.map((x) => x.end + 0.3)));
      const duration = Math.max(c.duration_s, Math.min(need, max));
      if (need > max) throw Object.assign(new Error(`The dialogue in this clip runs ${need} s, longer than ${max} s. Move a line to the next clip.`), { retryable: false });
      // Keep the clip's length in step with its dialogue, so later estimates and plans use the real length.
      if (duration > c.duration_s) await q("UPDATE episode_clips SET duration_s=$2 WHERE id=$1", [c.id, duration]);
      const stem = parts.length ? await buildStem(parts, duration) : null;
      // 2. References and prompt.
      const slots = await referenceSlots(e.project_id, await withSceneOutfits(e, c), MODELS[t.model].maxImages);
      if (!slots.length) throw Object.assign(new Error("This clip has no approved reference images. Add a look, place or prop to it."), { retryable: false });
      const prompt = composePrompt(c, slots, timed, e.settings.aspect_ratio);
      const spent = await videoSpentCents(e.project_id);
      if (spent + Number(t.est_cents) > VIDEO_BUDGET_CENTS) throw Object.assign(new Error("Over the project's video budget."), { retryable: false });
      await q("UPDATE episode_takes SET prompt=$2, ref_shas=$3, stem_sha=$4, duration_s=$5, line_texts=$6, line_times=$7 WHERE id=$1",
        [takeId, prompt, JSON.stringify(slots.map((s) => s.sha)), stem, duration,
          JSON.stringify(timed.map((x) => ({ id: x.id, text: x.text, speaker: lines.get(x.id)?.speaker }))), JSON.stringify(timed.map(({ id, start, end }) => ({ id, start, end })))]);
      // 3. Submit.
      const sub = await submitClip({ model: t.model, prompt, duration, aspect: e.settings.aspect_ratio, resolution: t.resolution,
        imageShas: slots.map((s) => s.sha), audioSha: stem, label: `Scene ${c.scene_n} · clip ${c.n}` });
      await q("UPDATE episode_takes SET request_id=$2, status='submitted', est_cents=COALESCE($3, est_cents) WHERE id=$1", [takeId, sub.requestId, sub.cents]);
      if (sub.mockVideo) return finishTake(takeId, c, e, sub.mockVideo, 0);
      t.request_id = sub.requestId;
      if (sub.cents != null) t.est_cents = String(sub.cents);
    }
    // 4. Poll, keeping the job alive so it is not mistaken for a dead worker.
    const deadline = Date.now() + 40 * 60_000;
    let netErrors = 0;
    while (Date.now() < deadline) {
      let s: Awaited<ReturnType<typeof clipStatus>>;
      try {
        s = await clipStatus(t.request_id!);
        netErrors = 0;
      } catch (err) {
        // A dropped connection must not fail a clip Higgsfield is still making (or has already made and billed):
        // keep polling the same request instead of starting a new one.
        const retryable = (err as { retryable?: boolean }).retryable !== false;
        if (!retryable || ++netErrors > 40) throw err;
        await q("UPDATE jobs SET locked_at=now() WHERE status='running' AND type='episodes.take' AND payload->>'takeId'=$1", [takeId]);
        await sleep(Math.min(5000 * netErrors, 30000));
        continue;
      }
      if (s.state === "done") {
        const cents = Number((await one<{ est_cents: string }>("SELECT est_cents FROM episode_takes WHERE id=$1", [takeId]))!.est_cents);
        return finishTake(takeId, c, e, s.video, cents);
      }
      if (s.state === "failed") return failTake(s.error);
      await q("UPDATE jobs SET locked_at=now() WHERE status='running' AND type='episodes.take' AND payload->>'takeId'=$1", [takeId]);
      await sleep(8000);
    }
    throw new Error("Higgsfield has not finished this clip after 40 minutes; it will be checked again.");
  } catch (err) {
    const retryable = (err as { retryable?: boolean }).retryable !== false;
    if (!retryable || lastAttempt) await failTake((err as Error).message);
    throw err;
  }
}

async function finishTake(takeId: string, c: Clip, e: Episode, video: Buffer, cents: number) {
  const sha = await storeFile(video, "video/mp4", "generated");
  await tx(async (db) => {
    await db.query("UPDATE episode_takes SET status='ready', video_sha=$2, cost_cents=$3, finished_at=now() WHERE id=$1", [takeId, sha, cents]);
    await db.query("UPDATE episode_clips SET status='ready', current_take_id=$2, error=NULL WHERE id=$1", [c.id, takeId]);
    if (cents) await db.query("INSERT INTO spend (project_id, category, provider, model, cents) VALUES ($1,'video','higgsfield',$2,$3)", [e.project_id, e.settings.model, cents]);
  });
  const open = await one<{ n: number }>("SELECT count(*)::int AS n FROM episode_clips WHERE episode_id=$1 AND status IN ('queued','generating')", [e.id]);
  if (!open!.n) await q("UPDATE episodes SET status='ready', updated_at=now() WHERE id=$1 AND status='generating'", [e.id]);
}

export async function chooseTake(takeId: string) {
  const t = await one<{ clip_id: string; status: string }>("SELECT clip_id, status FROM episode_takes WHERE id=$1", [takeId]);
  if (!t || t.status !== "ready") throw new Error("Only a finished take can be used.");
  await q("UPDATE episode_clips SET current_take_id=$2, status='ready', error=NULL WHERE id=$1", [t.clip_id, takeId]);
}

// ---------- Assembly ----------

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function esc(s: string) {
  return s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
}

/** Render every subtitle on one tall transparent page with headless Chrome (Devanagari shapes correctly), then cut it into one PNG per line. */
async function subtitlePngs(dir: string, texts: string[], width: number): Promise<string[]> {
  const ROW = Math.round(width * 0.26);
  // About 72 px on a 1080-wide frame: smaller captions were hard to read on a phone in the Episode 1 cut.
  const size = Math.round(width / 15);
  const html = `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;background:transparent}
    .r{height:${ROW}px;width:${width}px;display:flex;align-items:center;justify-content:center}
    .t{max-width:${Math.round(width * 0.86)}px;text-align:center;font:600 ${size}px/1.3 "Kohinoor Devanagari","Devanagari MT",sans-serif;color:#fff;
       text-shadow:0 0 6px rgba(0,0,0,.9),0 2px 3px rgba(0,0,0,.9);padding:6px 18px;border-radius:14px;background:rgba(0,0,0,.28)}
  </style>${texts.map((t) => `<div class="r"><div class="t">${esc(t)}</div></div>`).join("")}`;
  const page = path.join(dir, "subs.html");
  await writeFile(page, html);
  const big = path.join(dir, "subs.png");
  await run(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--default-background-color=00000000",
    `--window-size=${width},${ROW * texts.length}`, `--screenshot=${big}`, `file://${page}`], { timeout: 60_000 });
  const out: string[] = [];
  for (const i of texts.keys()) {
    const f = path.join(dir, `sub${i}.png`);
    await run("ffmpeg", ["-y", "-i", big, "-vf", `crop=${width}:${ROW}:0:${i * ROW}`, f]);
    out.push(f);
  }
  return out;
}

function srtTime(s: number) {
  const ms = Math.round(s * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
}

export async function queueAssembly(episodeId: string) {
  const open = await q<{ n: number }>("SELECT n FROM episode_clips WHERE episode_id=$1 AND (current_take_id IS NULL) ORDER BY n", [episodeId]);
  if (open.length) throw new Error(`Clip${open.length > 1 ? "s" : ""} ${open.map((o) => o.n).join(", ")} ${open.length > 1 ? "have" : "has"} no finished take yet.`);
  const e = (await one<{ project_id: string }>("SELECT project_id FROM episodes WHERE id=$1", [episodeId]))!;
  await q("UPDATE episodes SET status='assembling', error=NULL, updated_at=now() WHERE id=$1", [episodeId]);
  await enqueue("episodes.assemble", e.project_id, { episodeId });
}

export type ClipMapEntry = {
  clip_id: string; take_id: string; n: number; scene: number; start: number; end: number; trim_start: number;
  lines: { id: string; start: number; end: number }[];
};
type AsmClip = Clip & {
  video_sha: string; stem_sha: string | null; take_seconds: number; line_times: { id: string; start: number; end: number }[];
  trim_start: string; trim_end: string; ambience: string; sfx: { sha: string; at: number; volume: number; description: string }[]; mutes: { from: number; to: number }[];
};

/**
 * Assemble the current takes into a new numbered cut. Earlier cuts are kept.
 * Per clip: trims, the level of its own sound, mutes and added sound effects are applied here, so
 * edits that need no new footage cost nothing. `changed` marks where this cut differs from the one it revises.
 */
export async function assembleEpisode(episodeId: string, opts: {
  revisionId?: string; changed?: { clipId: string; label: string }[];
  /** Preview one scene: nothing is saved as a version; returns the preview file's sha. */
  previewScene?: number; dialogue?: "recorded" | "clip";
} = {}) {
  const e = (await one<Episode>("SELECT * FROM episodes WHERE id=$1", [episodeId]))!;
  if (opts.dialogue) e.settings.dialogue = opts.dialogue;
  const preview = opts.previewScene != null;
  try {
    const clips = await q<AsmClip>(
      `SELECT c.*, t.video_sha, t.stem_sha, t.duration_s AS take_seconds, t.line_times FROM episode_clips c
       JOIN episode_takes t ON t.id=c.current_take_id WHERE c.episode_id=$1 ${preview ? "AND c.scene_n=$2" : ""} ORDER BY c.n`,
      preview ? [episodeId, opts.previewScene] : [episodeId]);
    if (preview) {
      const all = await one<{ n: number }>("SELECT count(*)::int AS n FROM episode_clips WHERE episode_id=$1 AND scene_n=$2", [episodeId, opts.previewScene]);
      if (!clips.length || clips.length < all!.n) throw new Error("Every clip in this scene needs a finished take first.");
    }
    const { width: W, height: H, fps } = e.settings;
    const lines = new Map(allLines(e.screenplay).map((l) => [l.id, l]));
    const result = await withTmp(async (dir) => {
      const segs: string[] = [];
      const subs: { start: number; end: number; text: string }[] = [];
      const markers: { scene: number; title: string; start: number }[] = [];
      const clipMap: ClipMapEntry[] = [];
      let t0 = 0;
      for (const c of clips) {
        const v = path.join(dir, `c${c.n}.mp4`);
        await writeFile(v, (await readStored(c.video_sha)).buf);
        const full = Math.min(await probeSeconds(v), c.take_seconds || 99);
        const ts = Math.min(Math.max(Number(c.trim_start) || 0, 0), full - 0.5);
        const te = Math.max(full - Math.max(Number(c.trim_end) || 0, 0), ts + 0.5);
        const seconds = te - ts;
        const hasAudio = (await run("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", v])).stdout.trim() !== "";
        const args = ["-y", "-i", v];
        let idx = 1;
        let ambIn = "0:a";
        if (!hasAudio) { args.push("-f", "lavfi", "-t", full.toFixed(3), "-i", "anullsrc=r=48000:cl=stereo"); ambIn = `${idx++}:a`; }
        let stemIn: string | null = null;
        const useStem = !!c.stem_sha && e.settings.dialogue !== "clip";
        if (useStem) {
          const sp = path.join(dir, `s${c.n}.wav`);
          await writeFile(sp, (await readStored(c.stem_sha!)).buf);
          args.push("-i", sp); stemIn = `${idx++}:a`;
        }
        const fxIn: { input: string; at: number; volume: number }[] = [];
        for (const [k, fx] of (c.sfx ?? []).entries()) {
          const f = await readStored(fx.sha);
          const fp = path.join(dir, `fx${c.n}_${k}${f.mime === "audio/wav" ? ".wav" : ".mp3"}`);
          await writeFile(fp, f.buf);
          args.push("-i", fp); fxIn.push({ input: `${idx++}:a`, at: fx.at, volume: fx.volume ?? 1 });
        }
        const fmt = "aresample=48000,aformat=channel_layouts=stereo";
        // The clip's own sound: kept low under dialogue, full where nobody speaks (scaled from the same setting).
        const ownLevel = stemIn ? Number(c.ambience) : Math.min(1, Number(c.ambience) / 0.3);
        // With our recordings, silence the clip's own (re-voiced) speech under each line, with room for its timing drift.
        const lineGaps = useStem ? (c.line_times ?? []).map((l) => ({ from: Math.max(0, l.start - 0.35), to: l.end + 0.35 })) : [];
        const mutes = [...(c.mutes ?? []), ...lineGaps].map((m) => `,volume=0:enable='between(t,${m.from.toFixed(2)},${m.to.toFixed(2)})'`).join("");
        const parts = [`[${ambIn}]${fmt},volume=${ownLevel.toFixed(3)}${mutes}[amb]`];
        const mixIns = ["[amb]"];
        if (stemIn) { parts.push(`[${stemIn}]${fmt}[dlg]`); mixIns.push("[dlg]"); }
        fxIn.forEach((f, k) => { parts.push(`[${f.input}]${fmt},adelay=${Math.round(f.at * 1000)}:all=1,volume=${f.volume}[fx${k}]`); mixIns.push(`[fx${k}]`); });
        parts.push(`${mixIns.join("")}amix=inputs=${mixIns.length}:duration=first:normalize=0,atrim=start=${ts.toFixed(3)}:end=${te.toFixed(3)},asetpts=PTS-STARTPTS[a]`);
        const vf = `[0:v]trim=start=${ts.toFixed(3)}:end=${te.toFixed(3)},setpts=PTS-STARTPTS,scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${fps},format=yuv420p,setsar=1[v]`;
        const seg = path.join(dir, `seg${c.n}.mp4`);
        args.push("-filter_complex", [vf, ...parts].join(";"), "-map", "[v]", "-map", "[a]", "-t", seconds.toFixed(3),
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-r", String(fps), "-c:a", "aac", "-b:a", "192k", "-ar", "48000", seg);
        await run("ffmpeg", args, { maxBuffer: 1 << 24 });
        segs.push(seg);
        if (!markers.some((m) => m.scene === c.scene_n)) {
          markers.push({ scene: c.scene_n, title: e.screenplay.scenes.find((sc) => sc.n === c.scene_n)?.heading ?? `Scene ${c.scene_n}`, start: t0 });
        }
        const mapped: ClipMapEntry["lines"] = [];
        for (const lt of c.line_times ?? []) {
          if (lt.end <= ts || lt.start >= te) continue;
          const a = t0 + Math.max(lt.start, ts) - ts;
          const b = t0 + Math.min(lt.end, te) - ts;
          mapped.push({ id: lt.id, start: a, end: b });
          const l = lines.get(lt.id);
          if (l) subs.push({ start: a, end: Math.min(b + 0.25, t0 + seconds), text: l.devanagari });
        }
        clipMap.push({ clip_id: c.id, take_id: c.current_take_id!, n: c.n, scene: c.scene_n, start: t0, end: t0 + seconds, trim_start: ts, lines: mapped });
        t0 += seconds;
      }
      const list = path.join(dir, "list.txt");
      await writeFile(list, segs.map((x) => `file '${x}'`).join("\n"));
      const joined = path.join(dir, "joined.mp4");
      await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", joined], { maxBuffer: 1 << 24 });
      let final = joined;
      // A subtitle never runs into the next one.
      subs.sort((a, b) => a.start - b.start);
      for (let i = 0; i + 1 < subs.length; i++) subs[i].end = Math.min(subs[i].end, subs[i + 1].start - 0.05);
      if (e.settings.subtitles && subs.length) {
        const pngs = await subtitlePngs(dir, subs.map((x) => x.text), W);
        const y = Math.round(H * 0.74);
        const inputs = pngs.flatMap((x) => ["-i", x]);
        const chain = pngs.map((_, i) => `${i === 0 ? "[0:v]" : `[v${i}]`}[${i + 1}:v]overlay=0:${y}:enable='between(t,${subs[i].start.toFixed(2)},${subs[i].end.toFixed(2)})'[v${i + 1}]`).join(";");
        final = path.join(dir, "final.mp4");
        await run("ffmpeg", ["-y", "-i", joined, ...inputs, "-filter_complex", chain, "-map", `[v${pngs.length}]`, "-map", "0:a",
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-c:a", "copy", "-movflags", "+faststart", final], { maxBuffer: 1 << 24 });
      }
      const srt = subs.map((x, i) => `${i + 1}\n${srtTime(x.start)} --> ${srtTime(x.end)}\n${x.text}\n`).join("\n");
      return { video: await readFile(final), srt, markers, seconds: t0, clipMap };
    });
    const cut = await storeFile(result.video, "video/mp4", "derived");
    if (preview) return cut;
    const srt = await storeFile(Buffer.from(result.srt, "utf8"), "application/x-subrip", "derived");
    const changes = (opts.changed ?? []).flatMap((ch) => {
      const m = result.clipMap.find((x) => x.clip_id === ch.clipId);
      return m ? [{ start: m.start, end: m.end, label: ch.label }] : [];
    });
    const cutRow = await one<{ id: string; n: number }>(
      `INSERT INTO episode_cuts (episode_id, n, video_sha, srt_sha, seconds, markers, clip_map, revision_id, changes)
       VALUES ($1, (SELECT COALESCE(MAX(n),0)+1 FROM episode_cuts WHERE episode_id=$1), $2,$3,$4,$5,$6,$7,$8) RETURNING id, n`,
      [episodeId, cut, srt, result.seconds, JSON.stringify(result.markers), JSON.stringify(result.clipMap), opts.revisionId ?? null, JSON.stringify(changes)]);
    await q("UPDATE episodes SET cut_sha=$2, cut_srt_sha=$3, cut_markers=$4, current_cut_id=$5, status='assembled', error=NULL, updated_at=now() WHERE id=$1",
      [episodeId, cut, srt, JSON.stringify(result.markers), cutRow!.id]);
    await q("UPDATE projects SET step=GREATEST(step,5), updated_at=now() WHERE id=$1", [e.project_id]);
    await logEvent(e.project_id, "episode.assembled", { episode: e.number, seconds: result.seconds, version: cutRow!.n });
    return cutRow!.id;
  } catch (err) {
    if (preview) throw err;
    await q("UPDATE episodes SET status='ready', error=$2, updated_at=now() WHERE id=$1", [episodeId, `Assembly failed: ${(err as Error).message}`.slice(0, 800)]);
    throw Object.assign(err as Error, { retryable: false });
  }
}

// ---------- Edits ----------

export async function editLine(episodeId: string, lineId: string, patch: Partial<Pick<Line, "devanagari" | "english" | "roman" | "speaker" | "direction">>) {
  const e = (await one<Episode>("SELECT * FROM episodes WHERE id=$1", [episodeId]))!;
  let found = false;
  for (const s of e.screenplay.scenes) for (const l of s.lines) if (l.id === lineId) { Object.assign(l, patch); found = true; }
  if (!found) throw new Error("No such line.");
  await q("UPDATE episodes SET screenplay=$2, updated_at=now() WHERE id=$1", [episodeId, JSON.stringify(e.screenplay)]);
  if (patch.devanagari !== undefined || patch.speaker !== undefined) {
    await q("UPDATE episode_clips SET updated_at=now() WHERE episode_id=$1 AND lines @> $2::jsonb", [episodeId, JSON.stringify([{ id: lineId }])]);
    await q("UPDATE episode_lines SET status='stale', updated_at=now() WHERE episode_id=$1 AND line_id=$2", [episodeId, lineId]);
  }
}

const CLIP_FIELDS = ["duration_s", "shots", "lines", "refs", "prompt", "sound", "transition"] as const;
export async function editClip(clipId: string, patch: Record<string, unknown>) {
  const sets: string[] = [];
  const vals: unknown[] = [clipId];
  for (const f of CLIP_FIELDS) {
    if (!(f in patch)) continue;
    let v = patch[f];
    if (f === "duration_s") v = Math.min(Math.max(Math.round(Number(v)), 4), 30);
    vals.push(typeof v === "object" ? JSON.stringify(v) : v);
    sets.push(`${f}=$${vals.length}`);
  }
  if (!sets.length) return;
  await q(`UPDATE episode_clips SET ${sets.join(", ")}, updated_at=now() WHERE id=$1`, vals);
}

export async function editSettings(episodeId: string, patch: Partial<Settings>) {
  const e = (await one<Episode>("SELECT settings FROM episodes WHERE id=$1", [episodeId]))!;
  const s = { ...e.settings };
  if (patch.model && patch.model in MODELS) s.model = patch.model;
  if (patch.resolution && ["480p", "720p", "1080p"].includes(patch.resolution)) s.resolution = patch.resolution;
  if (typeof patch.subtitles === "boolean") s.subtitles = patch.subtitles;
  if (patch.dialogue === "recorded" || patch.dialogue === "clip") s.dialogue = patch.dialogue;
  await q("UPDATE episodes SET settings=$2, updated_at=now() WHERE id=$1", [episodeId, JSON.stringify(s)]);
}
