import { NextResponse } from "next/server";
import { q, one } from "@/lib/db";
import { bad, UUID } from "@/lib/api";
import { allLines, type Episode } from "@/lib/episodes";

export const runtime = "nodejs";

/** Step 5: the episode's cuts, notes and edit plans (?n=episode number; default: the newest episode with a cut). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return bad("not found", 404);
  const asked = Number(new URL(req.url).searchParams.get("n")) || null;
  const ep = await one<Episode & { current_cut_id: string | null }>(
    `SELECT * FROM episodes WHERE project_id=$1 AND current_cut_id IS NOT NULL ${asked ? "AND number=$2" : ""} ORDER BY updated_at DESC LIMIT 1`,
    asked ? [id, asked] : [id]);
  const withCuts = await q<{ number: number; title: string }>("SELECT number, title FROM episodes WHERE project_id=$1 AND current_cut_id IS NOT NULL ORDER BY number", [id]);
  if (!ep) return NextResponse.json({ episode: null, episodes: withCuts });
  const cuts = await q(
    `SELECT c.id, c.n, c.video_sha, c.srt_sha, c.seconds::float AS seconds, c.markers, c.clip_map, c.changes, c.revision_id, c.created_at,
       (SELECT r.base_cut_id FROM revisions r WHERE r.id=c.revision_id) AS base_cut_id
     FROM episode_cuts c WHERE c.episode_id=$1 ORDER BY c.n`, [ep.id]);
  const notes = await q(
    `SELECT n.id, n.cut_id, n.t_start::float AS t_start, n.t_end::float AS t_end, n.final_shot, n.text, n.status, n.revision_id, n.created_at,
       (SELECT c.n FROM episode_cuts c WHERE c.id=n.cut_id) AS cut_n
     FROM edit_notes n WHERE n.episode_id=$1 AND n.status<>'dismissed' ORDER BY n.t_start, n.created_at`, [ep.id]);
  const revisions = await q("SELECT * FROM revisions WHERE episode_id=$1 AND status<>'discarded' ORDER BY created_at DESC LIMIT 10", [ep.id]);
  const lines = allLines(ep.screenplay).map((l) => ({ id: l.id, scene: l.scene, devanagari: l.devanagari, english: l.english }));
  const job = await one("SELECT status, error FROM jobs WHERE project_id=$1 AND type LIKE 'revisions.%' ORDER BY created_at DESC LIMIT 1", [id]);
  const spent = await one<{ c: string }>("SELECT COALESCE(SUM(cents),0) AS c FROM spend WHERE project_id=$1", [id]);
  return NextResponse.json({
    episodes: withCuts, episode: { id: ep.id, number: ep.number, title: ep.title, settings: ep.settings, current_cut_id: ep.current_cut_id, status: ep.status },
    cuts, notes, revisions, lines, job, spentCents: Number(spent!.c),
  });
}
