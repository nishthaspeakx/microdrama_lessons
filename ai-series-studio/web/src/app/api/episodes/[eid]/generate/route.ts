import { q } from "@/lib/db";
import { bad, guard, UUID } from "@/lib/api";
import { queueTakes } from "@/lib/episodes";

export const runtime = "nodejs";

/** Generate clips: {clipIds}, {scene}, or {all:true} for every clip without a finished take. */
export async function POST(req: Request, { params }: { params: Promise<{ eid: string }> }) {
  const { eid } = await params;
  if (!UUID.test(eid)) return bad("not found", 404);
  const b = (await req.json().catch(() => ({}))) as { clipIds?: string[]; scene?: number; all?: boolean };
  return guard(async () => {
    let ids: string[] = [];
    if (b.clipIds?.length) ids = b.clipIds.filter((x) => UUID.test(x));
    else if (b.scene) ids = (await q<{ id: string }>("SELECT id FROM episode_clips WHERE episode_id=$1 AND scene_n=$2", [eid, b.scene])).map((r) => r.id);
    else if (b.all) ids = (await q<{ id: string }>("SELECT id FROM episode_clips WHERE episode_id=$1 AND current_take_id IS NULL", [eid])).map((r) => r.id);
    if (!ids.length) throw new Error("Nothing to generate.");
    return queueTakes(eid, ids);
  });
}
