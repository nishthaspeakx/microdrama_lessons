import { bad, guard, UUID } from "@/lib/api";
import { editLine } from "@/lib/episodes";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ eid: string; lineId: string }> }) {
  const { eid, lineId } = await params;
  if (!UUID.test(eid) || !/^S\d+L\d+$/.test(lineId)) return bad("not found", 404);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, string> = {};
  for (const k of ["devanagari", "english", "roman", "speaker", "direction"]) if (typeof b[k] === "string") patch[k] = (b[k] as string).trim();
  return guard(async () => { await editLine(eid, lineId, patch); return { ok: true }; });
}
