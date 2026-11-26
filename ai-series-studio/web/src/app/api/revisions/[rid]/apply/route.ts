import { bad, guard, UUID } from "@/lib/api";
import { queueApply } from "@/lib/revisions";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ rid: string }> }) {
  const { rid } = await params;
  if (!UUID.test(rid)) return bad("not found", 404);
  return guard(async () => { await queueApply(rid); return { ok: true }; });
}
