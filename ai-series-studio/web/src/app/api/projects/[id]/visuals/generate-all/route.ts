import { q } from "@/lib/db";
import { guard } from "@/lib/api";
import { createDraft, queueVersion, type Item } from "@/lib/visuals";

export const runtime = "nodejs";

/**
 * Generate every required item that has nothing to review yet. Parents go
 * first so outfits and later ages can use their approved look; items whose
 * parent is not approved yet are left for later and reported.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guard(async () => {
    const items = await q<Item>(
      `SELECT i.* FROM visual_items i WHERE i.project_id=$1 AND i.required AND i.status='todo'
       AND NOT EXISTS (SELECT 1 FROM visual_versions v WHERE v.item_id=i.id AND v.status IN ('queued','generating','ready'))
       ORDER BY i.sort`, [id]);
    const approved = new Set((await q<{ key: string }>("SELECT key FROM visual_items WHERE project_id=$1 AND status='approved'", [id])).map((r) => r.key));
    let queued = 0;
    const waiting: string[] = [];
    for (const it of items) {
      if (it.parent_key && !approved.has(it.parent_key)) { waiting.push(it.name); continue; }
      const draft = await createDraft(it);
      await queueVersion(draft);
      queued++;
    }
    return { queued, waiting };
  });
}
