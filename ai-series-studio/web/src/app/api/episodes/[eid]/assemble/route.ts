import { bad, guard, UUID } from "@/lib/api";
import { queueAssembly } from "@/lib/episodes";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ eid: string }> }) {
  const { eid } = await params;
  if (!UUID.test(eid)) return bad("not found", 404);
  return guard(async () => { await queueAssembly(eid); return { ok: true }; });
}
