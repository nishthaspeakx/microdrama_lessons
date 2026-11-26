import { bad, guard, UUID } from "@/lib/api";
import { approveChangeSet } from "@/lib/visuals";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  if (!UUID.test(setId)) return bad("not found", 404);
  return guard(async () => ({ approved: await approveChangeSet(setId) }));
}
