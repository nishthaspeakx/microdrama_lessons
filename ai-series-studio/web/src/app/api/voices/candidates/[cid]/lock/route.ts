import { bad, guard, UUID } from "@/lib/api";
import { lockCandidate } from "@/lib/voices";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  if (!UUID.test(cid)) return bad("not found", 404);
  return guard(() => lockCandidate(cid));
}
