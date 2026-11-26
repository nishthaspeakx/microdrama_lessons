import { q } from "@/lib/db";
import { bad, guard, UUID } from "@/lib/api";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: Promise<{ nid: string }> }) {
  const { nid } = await params;
  if (!UUID.test(nid)) return bad("not found", 404);
  return guard(async () => {
    const r = await q("UPDATE edit_notes SET status='dismissed' WHERE id=$1 AND status IN ('open','planned') RETURNING id", [nid]);
    if (!r.length) throw new Error("An applied note stays with its version.");
    return { ok: true };
  });
}
