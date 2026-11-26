import { bad, guard, UUID } from "@/lib/api";
import { addPastedVoice } from "@/lib/voices";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params;
  if (!UUID.test(roleId)) return bad("not found", 404);
  const { voiceId } = (await req.json()) as { voiceId?: string };
  if (!voiceId?.trim()) return bad("Paste a Voice ID.");
  return guard(async () => ({ candidateId: await addPastedVoice(roleId, voiceId.trim()) }));
}
