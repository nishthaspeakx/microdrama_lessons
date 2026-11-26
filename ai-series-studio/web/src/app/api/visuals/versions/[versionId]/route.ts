import { q } from "@/lib/db";
import { bad, guard, UUID } from "@/lib/api";
import { estimateCents } from "@/lib/visuals";

export const runtime = "nodejs";

/** Edit a draft's prompt or views before it is generated. */
export async function PATCH(req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  if (!UUID.test(versionId)) return bad("not found", 404);
  const body = (await req.json()) as { prompt?: string; views?: string[] };
  return guard(async () => {
    const r = await q<{ views: string[] }>("SELECT views FROM visual_versions WHERE id=$1 AND status='draft'", [versionId]);
    if (!r.length) throw new Error("Only a draft can be edited.");
    const views = body.views?.length ? body.views : r[0].views;
    await q("UPDATE visual_versions SET prompt=COALESCE($2,prompt), views=$3, est_cents=$4 WHERE id=$1",
      [versionId, body.prompt ?? null, views, estimateCents(views.length)]);
    return { ok: true };
  });
}

/** Discard a draft. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  if (!UUID.test(versionId)) return bad("not found", 404);
  return guard(async () => {
    await q("DELETE FROM visual_versions WHERE id=$1 AND status='draft'", [versionId]);
    return { ok: true };
  });
}
