import { bad, guard, UUID } from "@/lib/api";
import { editClip } from "@/lib/episodes";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  if (!UUID.test(cid)) return bad("not found", 404);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return guard(async () => { await editClip(cid, b); return { ok: true }; });
}
