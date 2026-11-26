import { bad, guard, UUID } from "@/lib/api";
import { planSceneChange } from "@/lib/sceneChanges";

export const runtime = "nodejs";
export const maxDuration = 300;

/** "Change this scene": {scene, request} → what was understood and which clips get a new version. Nothing is paid yet. */
export async function POST(req: Request, { params }: { params: Promise<{ eid: string }> }) {
  const { eid } = await params;
  if (!UUID.test(eid)) return bad("not found", 404);
  const b = (await req.json().catch(() => ({}))) as { scene?: number; request?: string };
  if (!b.scene) return bad("Which scene?");
  return guard(async () => ({ changeId: await planSceneChange(eid, Number(b.scene), String(b.request ?? "")) }));
}
