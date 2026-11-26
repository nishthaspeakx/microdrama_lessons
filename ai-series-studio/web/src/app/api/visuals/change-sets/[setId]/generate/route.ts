import { bad, guard, UUID } from "@/lib/api";
import { queueChangeSet } from "@/lib/visuals";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  if (!UUID.test(setId)) return bad("not found", 404);
  return guard(async () => ({ queued: await queueChangeSet(setId) }));
}
