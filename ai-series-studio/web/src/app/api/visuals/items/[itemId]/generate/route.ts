import { one } from "@/lib/db";
import { bad, guard, UUID } from "@/lib/api";
import { createDraft, queueVersion, type Item } from "@/lib/visuals";

export const runtime = "nodejs";

/** Generate one item. If its parent look is not approved yet, use the parent's newest version (waiting for it if needed). */
export async function POST(_req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  if (!UUID.test(itemId)) return bad("not found", 404);
  return guard(async () => {
    const item = await one<Item>("SELECT * FROM visual_items WHERE id=$1", [itemId]);
    if (!item) throw new Error("not found");
    let waitFor: string | null = null;
    if (item.parent_key) {
      const parent = await one<{ id: string; approved_version_id: string | null }>(
        "SELECT id, approved_version_id FROM visual_items WHERE project_id=$1 AND key=$2", [item.project_id, item.parent_key]);
      if (parent && !parent.approved_version_id) {
        const newest = await one<{ id: string }>(
          `SELECT id FROM visual_versions WHERE item_id=$1 AND status IN ('ready','queued','generating','waiting')
           ORDER BY (status='ready') DESC, n DESC LIMIT 1`, [parent.id]);
        waitFor = newest?.id ?? null;
      }
    }
    const id = await createDraft(item, { waitFor });
    return { versionId: id, status: await queueVersion(id) };
  });
}
