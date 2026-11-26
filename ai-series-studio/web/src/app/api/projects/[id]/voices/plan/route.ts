import { q } from "@/lib/db";
import { enqueue } from "@/lib/jobs";
import { guard } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guard(async () => {
    const r = await q("UPDATE projects SET voices_status='planning', updated_at=now() WHERE id=$1 AND voices_status<>'planning' RETURNING id", [id]);
    if (r.length) await enqueue("voices.plan", id);
    return { ok: true };
  });
}
