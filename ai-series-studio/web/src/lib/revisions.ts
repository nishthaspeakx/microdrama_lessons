/**
 * Step 5: timestamped notes → an edit plan → the smallest edit that meets each note → a new cut.
 * Timestamps always refer to the cut being watched; its clip map turns them into clips and lines.
 * Edits that need no new footage (trim, sound level, mute, added sound effect) are applied at assembly
 * and cost nothing in video. A changed line is re-recorded and its clip regenerated for lip-sync.
 * Replaced footage regenerates the clip, and the joins on both sides are shown for checking.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { q, one, logEvent } from "./db";
import { enqueue } from "./jobs";
import { runStructured } from "./llm";
import { readStored, storeFile } from "./storage";
import { soundEffect } from "./voice/provider";
import { estimateCents } from "./video/provider";
import { allLines, assembleEpisode, editLine, queueTakes, type Clip, type ClipMapEntry, type Episode } from "./episodes";

const run = promisify(execFile);

// ---------- Times ----------

/** "12", "12.5", "0:12", "1:02.5", ranges with - or – or "to", and "final" / "final shot". Seconds out. */
export function parseTime(input: string): { start: number; end: number | null; final: boolean } {
  const t = input.trim().toLowerCase();
  if (/^final( shot)?$/.test(t)) return { start: 0, end: null, final: true };
  const one = (x: string) => {
    const m = /^(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(x.trim());
    if (!m) throw new Error(`"${x.trim()}" is not a time. Use seconds (12), minutes and seconds (0:12) or a range (0:12-0:15).`);
    return (m[1] ? Number(m[1]) * 60 : 0) + Number(m[2]);
  };
  const parts = t.split(/\s*(?:-|–|—|to)\s*/).filter(Boolean);
  if (parts.length === 1) return { start: one(parts[0]), end: null, final: false };
  if (parts.length === 2) {
    const a = one(parts[0]), b = one(parts[1]);
    if (b <= a) throw new Error("The end of the range must come after its start.");
    return { start: a, end: b, final: false };
  }
  throw new Error("Use one time or one range.");
}

export const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;

type Cut = { id: string; episode_id: string; n: number; seconds: string; clip_map: ClipMapEntry[]; video_sha: string };

export async function addNote(episodeId: string, cutId: string, time: string, text: string) {
  const cut = await one<Cut>("SELECT * FROM episode_cuts WHERE id=$1 AND episode_id=$2", [cutId, episodeId]);
  if (!cut) throw new Error("That version was not found.");
  if (!text.trim()) throw new Error("Write what should change.");
  const t = parseTime(time);
  const len = Number(cut.seconds);
  if (!t.final && (t.start > len + 0.01 || (t.end ?? 0) > len + 0.5)) throw new Error(`This version is ${fmt(len)} long.`);
  const last = cut.clip_map[cut.clip_map.length - 1];
  const start = t.final ? last?.start ?? 0 : t.start;
  const end = t.final ? last?.end ?? len : t.end;
  const r = await one<{ id: string }>(
    "INSERT INTO edit_notes (episode_id, cut_id, t_start, t_end, final_shot, text) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
    [episodeId, cutId, start, end, t.final, text.trim()]);
  return r!.id;
}

// ---------- Planning ----------

const str = { type: "string" } as const;
const num = { type: "number" } as const;
const PLAN_SCHEMA = {
  type: "object", additionalProperties: false, required: ["instructions"],
  properties: {
    instructions: { type: "array", items: {
      type: "object", additionalProperties: false,
      required: ["note_id", "kind", "understood", "clip_n", "line_id", "new_devanagari", "new_english", "prompt", "duration_s",
        "sfx_description", "at_s", "volume", "level", "from_s", "to_s", "trim_start_s", "trim_end_s"],
      properties: {
        note_id: str, kind: str, understood: str, clip_n: { type: "integer" }, line_id: str, new_devanagari: str, new_english: str,
        prompt: str, duration_s: num, sfx_description: str, at_s: num, volume: num, level: num, from_s: num, to_s: num,
        trim_start_s: num, trim_end_s: num,
      },
    } },
  },
};

export type Instruction = {
  note_id: string; kind: "line_text" | "sfx" | "ambience" | "mute" | "trim" | "footage" | "none"; understood: string; clip_n: number;
  line_id: string; new_devanagari: string; new_english: string; prompt: string; duration_s: number; sfx_description: string;
  at_s: number; volume: number; level: number; from_s: number; to_s: number; trim_start_s: number; trim_end_s: number;
  // filled in by the app
  est_cents?: number; affects?: number[];
};

export const REVISION_SYSTEM = `# episode_revision v1 (2026-11-26)

You turn a viewer's timestamped notes on a cut of a vertical microdrama episode into precise production instructions. Apply the smallest edit that meets each note.

The input gives the cut being watched: every clip with its place in the cut (start and end, in cut seconds), its shots, prompt, sound settings and the lines spoken in it with their cut times; the screenplay lines; and the notes, each with its time range and the clips it falls in.

Instruction kinds, cheapest first. Use the cheapest kind that truly does what the note asks:
- "trim": shorten a clip. trim_start_s and trim_end_s are the NEW total seconds cut from the head and the tail of that clip's take (the input shows the current values and the take length). Free.
- "ambience": the level of the clip's own sound (room tone, effects the video model made) under our recorded dialogue. level 0 to 1; the default is 0.3 where someone speaks. Free.
- "mute": silence the clip's own sound between from_s and to_s, given in CUT seconds. Free. Our recorded dialogue stays.
- "sfx": add a sound effect. sfx_description is a short concrete description for a sound generator ("a steel plate set down on a wooden table, single clink"), at_s is when it starts in CUT seconds, duration_s its length (0.5 to 10), volume 0.2 to 1.5. Costs cents.
- "line_text": change what someone says. line_id, new_devanagari (Hindi in Devanagari, English words in Latin script, matching the screenplay style) and new_english. The line is recorded again with the locked voice and every clip containing it is regenerated so the lips match. Costs one clip of video.
- "footage": the picture must change (different action, framing, a replacement shot, a longer hold that trimming cannot give). prompt is the complete new prompt for that clip, rewritten from the current one with only what the note asks changed; keep everything else, including people, clothes, places and screen direction. duration_s is the new length (4 to 15) or 0 to keep it. Costs one clip of video, and the joins on both sides need checking.
- "none": the note cannot be done with these tools or is unclear. Say why in understood.

Rules:
- One note can need several instructions (for example a trim and a sound effect). Each instruction carries its note_id.
- Times in notes refer to this cut. Use the clips each note falls in; a note marked final_shot is about the last clip.
- understood: one plain sentence saying what you understood and what will change, in the viewer's terms, e.g. "Add the clink of a plate as the boy sets the jaggery down, at 0:06."
- Fill every field; use 0 or "" for fields the kind does not use. clip_n is the clip number (0 for line_text, which finds its clips itself).
- Do not invent changes nobody asked for.`;

export async function startRevision(episodeId: string) {
  const e = await one<{ current_cut_id: string | null; project_id: string }>("SELECT current_cut_id, project_id FROM episodes WHERE id=$1", [episodeId]);
  if (!e?.current_cut_id) throw new Error("Assemble a cut first.");
  const open = await q<{ id: string; cut_id: string }>("SELECT id, cut_id FROM edit_notes WHERE episode_id=$1 AND status='open'", [episodeId]);
  if (!open.length) throw new Error("Add at least one note first.");
  const busy = await one("SELECT id FROM revisions WHERE episode_id=$1 AND status IN ('planning','applying')", [episodeId]);
  if (busy) throw new Error("An edit is already being planned or applied.");
  await q("UPDATE revisions SET status='discarded', updated_at=now() WHERE episode_id=$1 AND status='planned'", [episodeId]);
  // Notes are planned against the cut they were written on; that is the base (the newest one if notes span versions).
  const base = await one<{ id: string }>(
    "SELECT c.id FROM episode_cuts c WHERE c.id = ANY($1) ORDER BY c.n DESC LIMIT 1", [[...new Set(open.map((o) => o.cut_id))]]);
  const r = await one<{ id: string }>("INSERT INTO revisions (episode_id, base_cut_id) VALUES ($1,$2) RETURNING id", [episodeId, base!.id]);
  await q("UPDATE edit_notes SET revision_id=$2 WHERE episode_id=$1 AND status='open'", [episodeId, r!.id]);
  await enqueue("revisions.plan", e.project_id, { revisionId: r!.id });
  return r!.id;
}

function clipsAt(map: ClipMapEntry[], a: number, b: number | null) {
  const end = b ?? a;
  return map.filter((m) => m.end > a - 0.001 && m.start <= end + 0.001).map((m) => m.n);
}

export async function planRevision(revisionId: string) {
  const r = (await one<{ id: string; episode_id: string; base_cut_id: string }>("SELECT * FROM revisions WHERE id=$1", [revisionId]))!;
  const e = (await one<Episode>("SELECT * FROM episodes WHERE id=$1", [r.episode_id]))!;
  try {
    const cut = (await one<Cut>("SELECT * FROM episode_cuts WHERE id=$1", [r.base_cut_id]))!;
    // Notes written on an older cut are mapped through that cut's own clip map.
    const notes = await q<{ id: string; cut_id: string; t_start: string; t_end: string | null; final_shot: boolean; text: string }>(
      "SELECT * FROM edit_notes WHERE revision_id=$1 ORDER BY t_start", [revisionId]);
    const maps = new Map<string, ClipMapEntry[]>();
    for (const n of notes) if (!maps.has(n.cut_id)) maps.set(n.cut_id, (await one<Cut>("SELECT clip_map FROM episode_cuts WHERE id=$1", [n.cut_id]))!.clip_map);
    const clips = new Map((await q<Clip & { trim_start: string; trim_end: string; ambience: string; take_seconds: number }>(
      `SELECT c.*, t.duration_s AS take_seconds FROM episode_clips c LEFT JOIN episode_takes t ON t.id=c.current_take_id WHERE c.episode_id=$1`, [e.id])).map((c) => [c.id, c]));
    const lines = new Map(allLines(e.screenplay).map((l) => [l.id, l]));
    const roles = new Map((await q<{ key: string; name: string }>("SELECT key, name FROM voice_roles WHERE project_id=$1", [e.project_id])).map((x) => [x.key, x.name]));
    const input = JSON.stringify({
      episode: { number: e.number, title: e.title, cut_version: cut.n, cut_seconds: Number(cut.seconds) },
      clips: cut.clip_map.map((m) => {
        const c = clips.get(m.clip_id)!;
        return {
          clip_n: m.n, scene: m.scene, cut_start: +m.start.toFixed(2), cut_end: +m.end.toFixed(2),
          take_seconds: c.take_seconds, trim_start_s: Number(c.trim_start), trim_end_s: Number(c.trim_end), ambience: Number(c.ambience),
          shots: c.shots, prompt: c.prompt, sound: c.sound, transition: c.transition,
          lines: m.lines.map((l) => ({ line_id: l.id, speaker: roles.get(lines.get(l.id)?.speaker ?? "") ?? "", text: lines.get(l.id)?.devanagari,
            english: lines.get(l.id)?.english, cut_start: +l.start.toFixed(2), cut_end: +l.end.toFixed(2) })),
        };
      }),
      notes: notes.map((n) => {
        const map = maps.get(n.cut_id)!;
        // Map the note's times into the base cut through the clip it falls in, if it was written on an older version.
        const a = Number(n.t_start), b = n.t_end == null ? null : Number(n.t_end);
        return { note_id: n.id, time: b == null ? fmt(a) : `${fmt(a)}–${fmt(b)}`, cut_seconds: [a, b], final_shot: n.final_shot,
          written_on_version: n.cut_id === cut.id ? cut.n : "an earlier version", clips: clipsAt(map, a, b), text: n.text };
      }),
    });
    const res = await runStructured<{ instructions: Instruction[] }>({ role: "episode_revision", system: REVISION_SYSTEM, input, schema: PLAN_SCHEMA, projectId: e.project_id });
    const noteIds = new Set(notes.map((n) => n.id));
    const plan = await priced(e, res.data.instructions.filter((i) => noteIds.has(i.note_id)));
    await q("UPDATE revisions SET plan=$2, status='planned', error=NULL, updated_at=now() WHERE id=$1", [revisionId, JSON.stringify(plan)]);
    await q("UPDATE edit_notes SET status='planned' WHERE revision_id=$1", [revisionId]);
  } catch (err) {
    await q("UPDATE revisions SET status='failed', error=$2, updated_at=now() WHERE id=$1", [revisionId, (err as Error).message.slice(0, 800)]);
    throw err;
  }
}

/** Which clips each instruction regenerates, and what it costs. */
async function priced(e: Episode, plan: Instruction[]) {
  const clips = await q<Clip>("SELECT * FROM episode_clips WHERE episode_id=$1", [e.id]);
  return Promise.all(plan.map(async (i) => {
    let affects: number[] = [];
    if (i.kind === "line_text") affects = clips.filter((c) => c.lines.some((l) => l.id === i.line_id)).map((c) => c.n);
    else if (i.clip_n) affects = [i.clip_n];
    let est = 0;
    if (i.kind === "line_text" || i.kind === "footage") {
      for (const n of affects) {
        const c = clips.find((x) => x.n === n);
        if (c) est += await estimateCents(e.settings.model, e.settings.resolution, i.kind === "footage" && i.duration_s ? i.duration_s : c.duration_s);
      }
    }
    if (i.kind === "sfx") est = 1;
    return { ...i, affects, est_cents: est };
  }));
}

export async function editPlan(revisionId: string, plan: Instruction[]) {
  const r = await one<{ status: string; episode_id: string }>("SELECT status, episode_id FROM revisions WHERE id=$1", [revisionId]);
  if (!r || r.status !== "planned") throw new Error("Only a plan that has not been applied can be edited.");
  const e = (await one<Episode>("SELECT * FROM episodes WHERE id=$1", [r.episode_id]))!;
  const kinds = ["line_text", "sfx", "ambience", "mute", "trim", "footage", "none"];
  const clean = plan.filter((i) => kinds.includes(i.kind));
  await q("UPDATE revisions SET plan=$2, user_edited=true, updated_at=now() WHERE id=$1", [revisionId, JSON.stringify(await priced(e, clean))]);
}

export async function discardRevision(revisionId: string) {
  const r = await one<{ status: string }>("SELECT status FROM revisions WHERE id=$1", [revisionId]);
  if (!r || !["planned", "failed"].includes(r.status)) throw new Error("This edit cannot be discarded now.");
  await q("UPDATE revisions SET status='discarded', updated_at=now() WHERE id=$1", [revisionId]);
  await q("UPDATE edit_notes SET status='open', revision_id=NULL WHERE revision_id=$1 AND status IN ('open','planned')", [revisionId]);
}

// ---------- Applying ----------

export async function queueApply(revisionId: string) {
  const r = await one<{ status: string; episode_id: string }>("SELECT status, episode_id FROM revisions WHERE id=$1", [revisionId]);
  if (!r || !["planned", "failed"].includes(r.status)) throw new Error("This plan is not ready to apply.");
  const e = (await one<{ project_id: string }>("SELECT project_id FROM episodes WHERE id=$1", [r.episode_id]))!;
  await q("UPDATE revisions SET status='applying', error=NULL, progress='Starting', updated_at=now() WHERE id=$1", [revisionId]);
  await enqueue("revisions.apply", e.project_id, { revisionId });
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
const progress = (id: string, text: string) => q("UPDATE revisions SET progress=$2, updated_at=now() WHERE id=$1", [id, text]);

/** Clip time (seconds in its untrimmed take) for a time in the given cut. */
function clipTime(m: ClipMapEntry, cutSeconds: number) {
  return Math.max(0, cutSeconds - m.start + m.trim_start);
}

export async function applyRevision(revisionId: string) {
  const r = (await one<{ id: string; episode_id: string; base_cut_id: string; plan: Instruction[]; edits_done: boolean; video_clip_ids: string[]; changed: { clipId: string; label: string; kind: string }[] }>(
    "SELECT * FROM revisions WHERE id=$1", [revisionId]))!;
  const e = (await one<Episode>("SELECT * FROM episodes WHERE id=$1", [r.episode_id]))!;
  try {
    const base = (await one<Cut>("SELECT * FROM episode_cuts WHERE id=$1", [r.base_cut_id]))!;
    const clips = await q<Clip & { sfx: unknown[]; mutes: unknown[] }>("SELECT * FROM episode_clips WHERE episode_id=$1", [e.id]);
    const byN = new Map(clips.map((c) => [c.n, c]));
    const mapOf = (n: number) => base.clip_map.find((m) => m.n === n);
    if (!r.edits_done) {
      const video = new Set<string>();
      const changed: { clipId: string; label: string; kind: string }[] = [];
      for (const i of r.plan) {
        const c = byN.get(i.clip_n);
        const m = mapOf(i.clip_n);
        if (i.kind === "line_text") {
          await editLine(e.id, i.line_id, { devanagari: i.new_devanagari, ...(i.new_english ? { english: i.new_english } : {}) });
          for (const x of clips.filter((k) => k.lines.some((l) => l.id === i.line_id))) { video.add(x.id); changed.push({ clipId: x.id, label: i.understood, kind: i.kind }); }
        } else if (!c || !m) {
          continue;
        } else if (i.kind === "footage") {
          // The rewritten prompt carries its own shots; the old shot list would contradict it.
          await q(`UPDATE episode_clips SET prompt=$2, shots=CASE WHEN $2 <> prompt THEN '[]'::jsonb ELSE shots END,
                     duration_s=CASE WHEN $3::int > 0 THEN $3::int ELSE duration_s END, updated_at=now() WHERE id=$1`,
            [c.id, i.prompt || c.prompt, Math.round(i.duration_s || 0)]);
          video.add(c.id); changed.push({ clipId: c.id, label: i.understood, kind: i.kind });
        } else if (i.kind === "trim") {
          await q("UPDATE episode_clips SET trim_start=$2, trim_end=$3 WHERE id=$1", [c.id, Math.max(0, i.trim_start_s), Math.max(0, i.trim_end_s)]);
          changed.push({ clipId: c.id, label: i.understood, kind: i.kind });
        } else if (i.kind === "ambience") {
          await q("UPDATE episode_clips SET ambience=$2 WHERE id=$1", [c.id, Math.min(Math.max(i.level, 0), 1)]);
          changed.push({ clipId: c.id, label: i.understood, kind: i.kind });
        } else if (i.kind === "mute") {
          const span = { from: +clipTime(m, i.from_s).toFixed(2), to: +clipTime(m, Math.max(i.to_s, i.from_s + 0.1)).toFixed(2) };
          await q("UPDATE episode_clips SET mutes = mutes || $2::jsonb WHERE id=$1", [c.id, JSON.stringify([span])]);
          changed.push({ clipId: c.id, label: i.understood, kind: i.kind });
        } else if (i.kind === "sfx") {
          await progress(revisionId, `Making the sound: ${i.sfx_description}`);
          const fx = await soundEffect(i.sfx_description, i.duration_s || 2);
          const sha = await storeFile(fx.audio, fx.mime, "generated");
          if (fx.cents) await q("INSERT INTO spend (project_id, category, provider, model, cents) VALUES ($1,'voice','elevenlabs','sound-effects',$2)", [e.project_id, fx.cents]);
          const item = { sha, at: +clipTime(m, i.at_s).toFixed(2), volume: Math.min(Math.max(i.volume || 1, 0.1), 2), description: i.sfx_description };
          await q("UPDATE episode_clips SET sfx = sfx || $2::jsonb WHERE id=$1", [c.id, JSON.stringify([item])]);
          changed.push({ clipId: c.id, label: i.understood, kind: i.kind });
        }
      }
      r.video_clip_ids = [...video];
      r.changed = changed;
      await q("UPDATE revisions SET edits_done=true, video_clip_ids=$2, changed=$3 WHERE id=$1", [revisionId, JSON.stringify(r.video_clip_ids), JSON.stringify(changed)]);
      if (r.video_clip_ids.length) await queueTakes(e.id, r.video_clip_ids);
    }
    // Wait for the new footage, keeping the job alive.
    const deadline = Date.now() + 50 * 60_000;
    while (r.video_clip_ids.length && Date.now() < deadline) {
      const st = await q<{ n: number; status: string; error: string | null }>("SELECT n, status, error FROM episode_clips WHERE id = ANY($1) ORDER BY n", [r.video_clip_ids]);
      const waiting = st.filter((x) => x.status === "queued" || x.status === "generating");
      if (!waiting.length) {
        const bad = st.filter((x) => x.status === "failed" || x.error);
        if (bad.length) throw Object.assign(new Error(`Clip ${bad.map((b) => `${b.n}: ${b.error ?? "failed"}`).join("; ")}. The other edits are saved; fix the clip in step 4 or retry.`), { retryable: false });
        break;
      }
      await progress(revisionId, `Making new footage for clip${st.length > 1 ? "s" : ""} ${st.map((x) => x.n).join(", ")} (${st.length - waiting.length} of ${st.length} done)`);
      await q("UPDATE jobs SET locked_at=now() WHERE status='running' AND type='revisions.apply' AND payload->>'revisionId'=$1", [revisionId]);
      await sleep(5000);
    }
    await progress(revisionId, "Assembling the new version");
    const cutId = await assembleEpisode(e.id, { revisionId, changed: r.changed.map((c) => ({ clipId: c.clipId, label: c.label })) });
    await addJoinSheets(cutId, new Set(r.changed.filter((c) => c.kind === "footage" || c.kind === "line_text" || c.kind === "trim").map((c) => c.clipId)));
    await q("UPDATE revisions SET status='applied', result_cut_id=$2, progress=NULL, updated_at=now() WHERE id=$1", [revisionId, cutId]);
    await q("UPDATE edit_notes SET status='applied' WHERE revision_id=$1", [revisionId]);
    await logEvent(e.project_id, "revision.applied", { episode: e.number, changes: r.changed.length });
  } catch (err) {
    await q("UPDATE revisions SET status='failed', error=$2, progress=NULL, updated_at=now() WHERE id=$1", [revisionId, (err as Error).message.slice(0, 800)]);
    throw Object.assign(err as Error, { retryable: false });
  }
}

/** For replaced or regenerated clips: the last and first frames on each side of both joins, as one strip to check. */
async function addJoinSheets(cutId: string, clipIds: Set<string>) {
  if (!clipIds.size) return;
  const cut = (await one<Cut & { changes: { start: number; end: number; label: string; joins_sha?: string }[] }>("SELECT * FROM episode_cuts WHERE id=$1", [cutId]))!;
  const dir = await mkdtemp(path.join(tmpdir(), "joins-"));
  try {
    const video = path.join(dir, "cut.mp4");
    await writeFile(video, (await readStored(cut.video_sha)).buf);
    const len = Number(cut.seconds);
    for (const ch of cut.changes) {
      const m = cut.clip_map.find((x) => Math.abs(x.start - ch.start) < 0.01 && clipIds.has(x.clip_id));
      if (!m) continue;
      const times = [m.start - 0.08, m.start + 0.05, m.end - 0.08, m.end + 0.05].map((t) => Math.min(Math.max(t, 0), len - 0.05));
      const frames: string[] = [];
      for (const [k, t] of times.entries()) {
        const f = path.join(dir, `f${k}.jpg`);
        await run("ffmpeg", ["-y", "-v", "error", "-ss", t.toFixed(3), "-i", video, "-frames:v", "1", "-vf", "scale=240:-2", f]);
        frames.push(f);
      }
      const sheet = path.join(dir, `sheet.jpg`);
      await run("ffmpeg", ["-y", "-v", "error", ...frames.flatMap((f) => ["-i", f]), "-filter_complex", "hstack=inputs=4", sheet]);
      ch.joins_sha = await storeFile(await readFile(sheet), "image/jpeg", "derived");
    }
    await q("UPDATE episode_cuts SET changes=$2 WHERE id=$1", [cutId, JSON.stringify(cut.changes)]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
