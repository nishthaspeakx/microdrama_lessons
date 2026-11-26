import { bad, guard, UUID } from "@/lib/api";
import { queueSuggestions } from "@/lib/voices";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params;
  if (!UUID.test(roleId)) return bad("not found", 404);
  return guard(async () => { await queueSuggestions(roleId); return { ok: true }; });
}
