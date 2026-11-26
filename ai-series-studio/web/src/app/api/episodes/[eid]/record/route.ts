import { one } from "@/lib/db";
import { enqueue } from "@/lib/jobs";
import { bad, guard, UUID } from "@/lib/api";

export const runtime = "nodejs";

/** Record every line with its locked voice (cheap; lets the timing be checked before paying for video). */
export async function POST(_req: Request, { params }: { params: Promise<{ eid: string }> }) {
  const { eid } = await params;
  if (!UUID.test(eid)) return bad("not found", 404);
  return guard(async () => {
    const e = await one<{ project_id: string }>("SELECT project_id FROM episodes WHERE id=$1", [eid]);
    if (!e) throw new Error("not found");
    return { jobId: await enqueue("episodes.lines", e.project_id, { episodeId: eid }) };
  });
}
