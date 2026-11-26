import { bad, guard, UUID } from "@/lib/api";
import { editPlan, discardRevision, type Instruction } from "@/lib/revisions";

export const runtime = "nodejs";

/** Save the user's edited plan; applying uses it as saved. */
export async function PATCH(req: Request, { params }: { params: Promise<{ rid: string }> }) {
  const { rid } = await params;
  if (!UUID.test(rid)) return bad("not found", 404);
  const b = (await req.json().catch(() => ({}))) as { plan?: Instruction[] };
  if (!Array.isArray(b.plan)) return bad("plan missing");
  return guard(async () => { await editPlan(rid, b.plan!); return { ok: true }; });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ rid: string }> }) {
  const { rid } = await params;
  if (!UUID.test(rid)) return bad("not found", 404);
  return guard(async () => { await discardRevision(rid); return { ok: true }; });
}
