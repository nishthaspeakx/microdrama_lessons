import { bad, guard, UUID } from "@/lib/api";
import { addNote } from "@/lib/revisions";

export const runtime = "nodejs";

/** Add a timestamped note: {cutId, time: "0:12" | "0:12-0:15" | "final", text}. */
export async function POST(req: Request, { params }: { params: Promise<{ eid: string }> }) {
  const { eid } = await params;
  if (!UUID.test(eid)) return bad("not found", 404);
  const b = (await req.json().catch(() => ({}))) as { cutId?: string; time?: string; text?: string };
  if (!b.cutId || !UUID.test(b.cutId)) return bad("Which version is this note about?");
  return guard(async () => ({ noteId: await addNote(eid, b.cutId!, String(b.time ?? ""), String(b.text ?? "")) }));
}
