import { one } from "@/lib/db";
import { bad, guard, UUID } from "@/lib/api";
import { interpretChange, type Item } from "@/lib/visuals";

export const runtime = "nodejs";

/** Plain-words change → a draft version with the understood change and the full prompt, shown before generating. */
export async function POST(req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  if (!UUID.test(itemId)) return bad("not found", 404);
  const { request, baseVersionId } = (await req.json()) as { request?: string; baseVersionId?: string };
  if (!request?.trim()) return bad("Say what should change.");
  if (!baseVersionId || !UUID.test(baseVersionId)) return bad("Pick the version to change.");
  return guard(async () => {
    const item = await one<Item>("SELECT * FROM visual_items WHERE id=$1", [itemId]);
    if (!item) throw new Error("not found");
    return { versionId: await interpretChange(item, baseVersionId, request.trim()) };
  });
}
