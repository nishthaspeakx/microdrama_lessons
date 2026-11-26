import { bad, guard, UUID } from "@/lib/api";
import { startRevision } from "@/lib/revisions";

export const runtime = "nodejs";

/** "Edit video": plan the open notes into production instructions. */
export async function POST(_req: Request, { params }: { params: Promise<{ eid: string }> }) {
  const { eid } = await params;
  if (!UUID.test(eid)) return bad("not found", 404);
  return guard(async () => ({ revisionId: await startRevision(eid) }));
}
