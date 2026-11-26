import { q } from "@/lib/db";
import { enqueue } from "@/lib/jobs";
import { guard } from "@/lib/api";

export const runtime = "nodejs";

/** Plan (or re-plan) the list of items to approve from the step 1 summary. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guard(async () => {
    const r = await q("UPDATE projects SET visuals_status='planning', updated_at=now() WHERE id=$1 AND visuals_status<>'planning' RETURNING id", [id]);
    if (r.length) await enqueue("visuals.plan", id);
    return { ok: true };
  });
}
