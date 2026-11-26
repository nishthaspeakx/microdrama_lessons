/**
 * Step 4 "Change this scene": a plain-words request ("the mother and father should look at each other, as if
 * talking") → Claude shows what it understood and rewrites only the clips that need it → one click makes v2 of
 * those clips. Everything else in the scene stays as it is.
 */
import { q, one, logEvent } from "./db";
import { runStructured } from "./llm";
import { editLine, queueTakes, allLines, type Clip, type Episode } from "./episodes";
import { estimateCents, MODELS } from "./video/provider";

const str = { type: "string" } as const;
const num = { type: "number" } as const;
const obj = (p: Record<string, object>) => ({ type: "object", additionalProperties: false, required: Object.keys(p), properties: p });
const SCHEMA = obj({
  understood: str, cannot: str,
  clips: { type: "array", items: obj({
    clip_n: { type: "integer" }, why: str, prompt: str, duration_s: { type: "integer" },
    shots: { type: "array", items: obj({ t0: num, t1: num, framing: str, action: str }) },
  }) },
  lines: { type: "array", items: obj({ line_id: str, new_devanagari: str, new_english: str }) },
});

export const SCENE_CHANGE_SYSTEM = `# scene_change v1 (2026-11-26)

A creator asks for a change to one scene of a vertical microdrama, in plain words. You rewrite only the clips that need it so the video model makes a new version of them.

The input gives the scene: its screenplay lines and every clip (number, length, timed shots, the prompt sent to the video model, references, who speaks when, sound). Then the request.

Return:
- understood: one or two plain sentences in the creator's terms saying what will change and in which clips, e.g. "Suman and Devendra will face each other and hold eye contact while they talk in clips 2 and 3; the boy and the table stay as they are."
- clips: only the clips that must change. For each: clip_n, why (a short reason), prompt (the complete new prompt for that clip: the current prompt with only what the request asks changed, keeping the people, clothes, place, light, screen direction and who speaks when), shots (the new timed shots, back to back from 0 to the clip's length), duration_s (the new length, 4 to MAX, or 0 to keep it).
- lines: only if the request changes what someone says: line_id, new_devanagari (Hindi in Devanagari, English words in Latin script), new_english. Otherwise empty.
- cannot: anything in the request you could not do here (for example a change to another scene, or to music), else "".

Rules: keep every line in the same clip and at the same time unless the request is about timing. Make eye lines, who looks at whom, and positions explicit in the prompt and shots (for example "Suman at frame left turns to face Devendra at frame right; they look into each other's eyes"). When a child or minor is in frame, every adult wears full upper-body clothing. Do not change anything the request does not ask for.`;

type Plan = {
  understood: string; cannot: string;
  clips: { clip_n: number; why: string; prompt: string; duration_s: number; shots: Clip["shots"] }[];
  lines: { line_id: string; new_devanagari: string; new_english: string }[];
};

export async function planSceneChange(episodeId: string, sceneN: number, request: string) {
  if (!request.trim()) throw new Error("Write what should change in this scene.");
  const e = (await one<Episode>("SELECT * FROM episodes WHERE id=$1", [episodeId]))!;
  const scene = e.screenplay.scenes.find((s) => s.n === sceneN);
  if (!scene) throw new Error("No such scene.");
  const clips = await q<Clip>("SELECT * FROM episode_clips WHERE episode_id=$1 AND scene_n=$2 ORDER BY n", [episodeId, sceneN]);
  const roles = new Map((await q<{ key: string; name: string }>("SELECT key, name FROM voice_roles WHERE project_id=$1", [e.project_id])).map((r) => [r.key, r.name]));
  const max = MODELS[e.settings.model].maxSeconds;
  const input = JSON.stringify({
    scene: { n: scene.n, heading: scene.heading, summary: scene.summary,
      lines: scene.lines.map((l) => ({ id: l.id, speaker: roles.get(l.speaker) ?? l.speaker, devanagari: l.devanagari, english: l.english })) },
    clips: clips.map((c) => ({ clip_n: c.n, duration_s: c.duration_s, shots: c.shots, prompt: c.prompt, refs: c.refs, sound: c.sound, lines: c.lines })),
    request: request.trim(),
  });
  const res = await runStructured<Plan>({
    role: "scene_change", system: SCENE_CHANGE_SYSTEM.replace("MAX", String(max)), input, schema: SCHEMA, projectId: e.project_id,
  });
  const byN = new Map(clips.map((c) => [c.n, c]));
  const plan: Plan = {
    ...res.data,
    clips: res.data.clips.filter((x) => byN.has(x.clip_n)).map((x) => ({ ...x, duration_s: x.duration_s ? Math.min(Math.max(x.duration_s, 4), max) : 0 })),
    lines: res.data.lines.filter((l) => scene.lines.some((s) => s.id === l.line_id)),
  };
  // Clips to remake: those rewritten, plus any whose line changes (new speech needs new lip-sync).
  const remake = new Set(plan.clips.map((x) => x.clip_n));
  for (const l of plan.lines) for (const c of clips) if (c.lines.some((x) => x.id === l.line_id)) remake.add(c.n);
  let est = 0;
  for (const n of remake) {
    const c = byN.get(n)!;
    const d = plan.clips.find((x) => x.clip_n === n)?.duration_s || c.duration_s;
    est += await estimateCents(e.settings.model, e.settings.resolution, d);
  }
  await q("UPDATE scene_changes SET status='discarded' WHERE episode_id=$1 AND scene_n=$2 AND status='planned'", [episodeId, sceneN]);
  const row = await one<{ id: string }>(
    "INSERT INTO scene_changes (episode_id, scene_n, request, understood, plan, est_cents) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
    [episodeId, sceneN, request.trim(), plan.understood, JSON.stringify({ ...plan, remake: [...remake].sort((a, b) => a - b) }), est]);
  return row!.id;
}

/** Apply the rewritten prompts and lines, then make v-next of each affected clip. */
export async function applySceneChange(changeId: string) {
  const ch = await one<{ id: string; episode_id: string; scene_n: number; status: string; plan: Plan & { remake: number[] }; request: string }>(
    "SELECT * FROM scene_changes WHERE id=$1", [changeId]);
  if (!ch || ch.status !== "planned") throw new Error("This change has already been applied or discarded.");
  const e = (await one<Episode>("SELECT * FROM episodes WHERE id=$1", [ch.episode_id]))!;
  const clips = await q<Clip>("SELECT * FROM episode_clips WHERE episode_id=$1 AND scene_n=$2", [ch.episode_id, ch.scene_n]);
  if (clips.some((c) => ch.plan.remake.includes(c.n) && (c.status === "queued" || c.status === "generating")))
    throw new Error("One of these clips is still being made. Wait for it, then apply.");
  for (const x of ch.plan.clips) {
    const c = clips.find((k) => k.n === x.clip_n);
    if (!c) continue;
    await q("UPDATE episode_clips SET prompt=$2, shots=$3, duration_s=CASE WHEN $4::int > 0 THEN $4::int ELSE duration_s END, updated_at=now() WHERE id=$1",
      [c.id, x.prompt, JSON.stringify(x.shots), x.duration_s]);
  }
  for (const l of ch.plan.lines) await editLine(ch.episode_id, l.line_id, { devanagari: l.new_devanagari, english: l.new_english });
  const ids = clips.filter((c) => ch.plan.remake.includes(c.n)).map((c) => c.id);
  const res = ids.length ? await queueTakes(ch.episode_id, ids) : { estCents: 0 };
  await q("UPDATE scene_changes SET status='applied' WHERE id=$1", [changeId]);
  await logEvent(e.project_id, "scene.changed", { episode: e.number, scene: ch.scene_n, clips: ch.plan.remake, lines: allLines(e.screenplay).length });
  return res;
}

export async function discardSceneChange(changeId: string) {
  await q("UPDATE scene_changes SET status='discarded' WHERE id=$1 AND status='planned'", [changeId]);
}
