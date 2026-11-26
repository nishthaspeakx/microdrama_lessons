import { bad, guard, UUID } from "@/lib/api";
import { auditionLibraryVoice, libraryFor } from "@/lib/voices";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ roleId: string }> };

/** Hindi voices from the ElevenLabs library that fit this role (free). */
export async function GET(req: Request, { params }: Ctx) {
  const { roleId } = await params;
  if (!UUID.test(roleId)) return bad("not found", 404);
  const u = new URL(req.url).searchParams;
  return guard(() => libraryFor(roleId, { gender: u.get("gender") ?? undefined, age: u.get("age") ?? undefined, search: u.get("search") ?? undefined }));
}

/** Audition one library voice on the role's own text. */
export async function POST(req: Request, { params }: Ctx) {
  const { roleId } = await params;
  if (!UUID.test(roleId)) return bad("not found", 404);
  const b = (await req.json()) as { voiceId?: string; publicOwnerId?: string; name?: string };
  if (!b.voiceId || !b.publicOwnerId || !b.name) return bad("Pick a voice from the list.");
  return guard(async () => ({ candidateId: await auditionLibraryVoice(roleId, { voiceId: b.voiceId!, publicOwnerId: b.publicOwnerId!, name: b.name! }) }));
}
