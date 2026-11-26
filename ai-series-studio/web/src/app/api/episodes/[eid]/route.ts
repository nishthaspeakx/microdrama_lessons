import { bad, guard, UUID } from "@/lib/api";
import { editSettings } from "@/lib/episodes";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ eid: string }> }) {
  const { eid } = await params;
  if (!UUID.test(eid)) return bad("not found", 404);
  const b = await req.json().catch(() => ({}));
  return guard(async () => { await editSettings(eid, b.settings ?? {}); return { ok: true }; });
}
