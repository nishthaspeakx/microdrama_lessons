import { NextResponse } from "next/server";
import { q, one } from "@/lib/db";
import { bad, guard, UUID } from "@/lib/api";
import { startEpisode, nextEpisodeNumber, allLines, estSeconds, videoSpentCents, type Episode } from "@/lib/episodes";
import { estimateCents, videoProvider, MODELS } from "@/lib/video/provider";
import type { Intake } from "@/lib/intakeSchema";

export const runtime = "nodejs";

/** Everything step 4 shows for one episode (?n=number; default: the one in progress, else the next to make). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return bad("not found", 404);
  const intake = await one<{ summary: Intake }>("SELECT summary FROM intake WHERE project_id=$1", [id]);
  if (!intake) return bad("not found", 404);
  const s = intake.summary;
  const started = await q<{ number: number }>("SELECT number FROM episodes WHERE project_id=$1 ORDER BY updated_at DESC", [id]);
  const asked = Number(new URL(req.url).searchParams.get("n")) || null;
  const nextN = nextEpisodeNumber(s);
  const number = asked ?? started[0]?.number ?? nextN;
  const episodes = s.episodes.map((e) => ({ number: e.number, title: e.title, runtime: e.runtime, summary: e.summary, script: e.script.status,
    note: e.script.note, started: started.some((x) => x.number === e.number), suggested: e.number === nextN }));
  const ep = await one<Episode & { updated_at: string }>("SELECT * FROM episodes WHERE project_id=$1 AND number=$2", [id, number]);
  const roles = await q(
    `SELECT r.key, r.name, r.status='locked' AS locked, r.portrait_item_key,
       (SELECT im.file_sha FROM visual_items i JOIN visual_images im ON im.version_id=i.approved_version_id
        WHERE i.project_id=r.project_id AND i.key=r.portrait_item_key ORDER BY (im.view='face') DESC LIMIT 1) AS portrait_sha
     FROM voice_roles r WHERE r.project_id=$1 ORDER BY r.sort`, [id]);
  const items = await q(
    `SELECT i.key, i.name, i.category, i.parent_key,
       (SELECT im.file_sha FROM visual_images im WHERE im.version_id=i.approved_version_id
        ORDER BY (im.view IN ('face','establishing','three_quarter','outfit')) DESC, (im.view='portfolio') ASC LIMIT 1) AS thumb_sha
     FROM visual_items i WHERE i.project_id=$1 AND i.approved_version_id IS NOT NULL ORDER BY i.sort`, [id]);
  const planJob = await one("SELECT status, error FROM jobs WHERE project_id=$1 AND type='episodes.plan' ORDER BY created_at DESC LIMIT 1", [id]);
  const spent = await one<{ c: string }>("SELECT COALESCE(SUM(cents),0) AS c FROM spend WHERE project_id=$1", [id]);
  const base = { episodes, number, roles, items, planJob, spentCents: Number(spent!.c),
    provider: { name: videoProvider(), models: Object.fromEntries(Object.entries(MODELS).map(([k, v]) => [k, v.label])) } };
  if (!ep) return NextResponse.json({ ...base, episode: null });

  const clips = await q(
    `SELECT c.*, (c.current_take_id IS NOT NULL AND c.updated_at > (SELECT created_at FROM episode_takes WHERE id=c.current_take_id)) AS changed_since_take
     FROM episode_clips c WHERE c.episode_id=$1 ORDER BY c.n`, [ep.id]);
  const takes = await q(
    `SELECT t.id, t.clip_id, t.n, t.provider, t.model, t.resolution, t.duration_s, t.prompt, t.status, t.video_sha, t.error,
       t.est_cents::float AS est_cents, t.cost_cents::float AS cost_cents, t.line_texts, t.created_at
     FROM episode_takes t JOIN episode_clips c ON c.id=t.clip_id WHERE c.episode_id=$1 ORDER BY t.n DESC`, [ep.id]);
  const linesJob = await one("SELECT status, error FROM jobs WHERE project_id=$1 AND type='episodes.lines' AND payload->>'episodeId'=$2 ORDER BY created_at DESC LIMIT 1", [id, ep.id]);
  const recs = await q("SELECT line_id, role_key, status, audio_sha, duration_s::float AS duration_s, error FROM episode_lines WHERE episode_id=$1", [ep.id]);
  let estCents = 0;
  for (const c of clips as { duration_s: number; current_take_id: string | null }[]) {
    if (!c.current_take_id) estCents += await estimateCents(ep.settings.model, ep.settings.resolution, c.duration_s);
  }
  const lines = allLines(ep.screenplay).map((l) => ({ id: l.id, est: estSeconds(l.devanagari) }));
  return NextResponse.json({
    ...base, episode: ep, clips, takes, recordings: recs, linesJob, lineEstimates: lines,
    estimate: { remainingCents: estCents, runtimeS: (clips as { duration_s: number }[]).reduce((a, c) => a + c.duration_s, 0) },
    videoSpentCents: await videoSpentCents(id),
  });
}

/** Start (or re-plan) an episode: Claude writes the screenplay and the clips. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return bad("not found", 404);
  const b = (await req.json().catch(() => ({}))) as { number?: number };
  return guard(async () => ({ episodeId: await startEpisode(id, b.number) }));
}
