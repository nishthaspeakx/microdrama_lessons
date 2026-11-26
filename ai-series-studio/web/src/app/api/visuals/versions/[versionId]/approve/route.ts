import { bad, guard, UUID } from "@/lib/api";
import { approveVersion } from "@/lib/visuals";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  if (!UUID.test(versionId)) return bad("not found", 404);
  return guard(() => approveVersion(versionId));
}
