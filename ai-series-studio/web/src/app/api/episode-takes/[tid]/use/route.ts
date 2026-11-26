import { bad, guard, UUID } from "@/lib/api";
import { chooseTake } from "@/lib/episodes";

export const runtime = "nodejs";

/** Make an earlier take the one the cut uses. */
export async function POST(_req: Request, { params }: { params: Promise<{ tid: string }> }) {
  const { tid } = await params;
  if (!UUID.test(tid)) return bad("not found", 404);
  return guard(async () => { await chooseTake(tid); return { ok: true }; });
}
