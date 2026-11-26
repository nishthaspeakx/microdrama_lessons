import { bad, guard, UUID } from "@/lib/api";
import { applySceneChange } from "@/lib/sceneChanges";

export const runtime = "nodejs";

/** Generate the new version of the clips this change rewrites. */
export async function POST(_req: Request, { params }: { params: Promise<{ sid: string }> }) {
  const { sid } = await params;
  if (!UUID.test(sid)) return bad("not found", 404);
  return guard(async () => applySceneChange(sid));
}
