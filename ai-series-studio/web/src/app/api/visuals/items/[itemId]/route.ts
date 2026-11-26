import { q } from "@/lib/db";
import { bad, guard, UUID } from "@/lib/api";

export const runtime = "nodejs";

/** Edit the description or whether the item is required. */
export async function PATCH(req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  if (!UUID.test(itemId)) return bad("not found", 404);
  const body = (await req.json()) as { description?: string; required?: boolean };
  return guard(async () => {
    if (body.description !== undefined) await q("UPDATE visual_items SET description=$2, updated_at=now() WHERE id=$1", [itemId, String(body.description)]);
    if (body.required !== undefined) await q("UPDATE visual_items SET required=$2, updated_at=now() WHERE id=$1", [itemId, !!body.required]);
    return { ok: true };
  });
}
