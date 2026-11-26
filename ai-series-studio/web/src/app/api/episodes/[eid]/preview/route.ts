import { bad, guard, UUID } from "@/lib/api";
import { assembleEpisode } from "@/lib/episodes";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Put one scene together to watch and listen, without saving a version: {scene, dialogue?: "recorded" | "clip"}. */
export async function POST(req: Request, { params }: { params: Promise<{ eid: string }> }) {
  const { eid } = await params;
  if (!UUID.test(eid)) return bad("not found", 404);
  const b = (await req.json().catch(() => ({}))) as { scene?: number; dialogue?: string };
  if (!b.scene) return bad("Which scene?");
  const dialogue = b.dialogue === "clip" ? "clip" : "recorded";
  return guard(async () => ({ sha: await assembleEpisode(eid, { previewScene: Number(b.scene), dialogue }), dialogue }));
}
