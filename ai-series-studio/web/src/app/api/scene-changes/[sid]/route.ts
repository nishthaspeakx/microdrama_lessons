import { bad, guard, UUID } from "@/lib/api";
import { discardSceneChange } from "@/lib/sceneChanges";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: Promise<{ sid: string }> }) {
  const { sid } = await params;
  if (!UUID.test(sid)) return bad("not found", 404);
  return guard(async () => { await discardSceneChange(sid); return { ok: true }; });
}
