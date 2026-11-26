import { one } from "@/lib/db";
import { bad, guard, UUID } from "@/lib/api";
import { createDraft, queueVersion, type Item } from "@/lib/visuals";

export const runtime = "nodejs";

/** First generation of an item from its planned prompt. */
export async function POST(_req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  if (!UUID.test(itemId)) return bad("not found", 404);
  return guard(async () => {
    const item = await one<Item>("SELECT * FROM visual_items WHERE id=$1", [itemId]);
    if (!item) throw new Error("not found");
    const id = await createDraft(item);
    return { versionId: id, status: await queueVersion(id) };
  });
}
