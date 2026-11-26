import { q } from "@/lib/db";
import { bad, guard, UUID } from "@/lib/api";
import { storeFile } from "@/lib/storage";

export const runtime = "nodejs";
const OK = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a"];

/** A recording of how this character should sound, used to guide Voice Design. */
export async function POST(req: Request, { params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params;
  if (!UUID.test(roleId)) return bad("not found", 404);
  const f = (await req.formData()).get("file");
  if (!(f instanceof File) || !f.size) return bad("Choose a recording.");
  if (!OK.includes(f.type)) return bad("Use an MP3, WAV or M4A recording.");
  if (f.size > 10 * 1024 * 1024) return bad("The recording is larger than 10 MB.");
  return guard(async () => {
    const sha = await storeFile(Buffer.from(await f.arrayBuffer()), f.type === "audio/x-wav" ? "audio/wav" : f.type, "upload");
    await q("UPDATE voice_roles SET reference_audio_sha=$2, updated_at=now() WHERE id=$1", [roleId, sha]);
    return { ok: true };
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params;
  if (!UUID.test(roleId)) return bad("not found", 404);
  return guard(async () => { await q("UPDATE voice_roles SET reference_audio_sha=NULL WHERE id=$1", [roleId]); return { ok: true }; });
}
