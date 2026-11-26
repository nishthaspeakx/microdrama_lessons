import { q } from "@/lib/db";
import { bad, guard, UUID } from "@/lib/api";

export const runtime = "nodejs";

/** Edit the voice brief or the audition text. */
export async function PATCH(req: Request, { params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params;
  if (!UUID.test(roleId)) return bad("not found", 404);
  const b = (await req.json()) as { voice_brief?: string; audition_text?: string };
  return guard(async () => {
    if (b.voice_brief !== undefined) await q("UPDATE voice_roles SET voice_brief=$2, updated_at=now() WHERE id=$1", [roleId, String(b.voice_brief)]);
    if (b.audition_text !== undefined) await q("UPDATE voice_roles SET audition_text=$2, updated_at=now() WHERE id=$1", [roleId, String(b.audition_text)]);
    return { ok: true };
  });
}
