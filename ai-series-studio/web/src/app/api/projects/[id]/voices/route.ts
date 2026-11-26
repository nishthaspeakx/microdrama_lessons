import { NextResponse } from "next/server";
import { q, one } from "@/lib/db";
import { bad, UUID } from "@/lib/api";
import { voiceProvider, DESIGN_MODEL, TTS_MODEL } from "@/lib/voice/provider";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return bad("not found", 404);
  const p = await one<{ voices_status: string }>("SELECT voices_status FROM projects WHERE id=$1", [id]);
  if (!p) return bad("not found", 404);
  const roles = await q("SELECT * FROM voice_roles WHERE project_id=$1 ORDER BY sort, name", [id]);
  const candidates = await q(
    `SELECT c.id, c.role_id, c.n, c.source, c.label, c.provider, c.provider_voice_id, c.description, c.model, c.text, c.audio_sha,
            c.status, c.error, c.cost_cents::float AS cost_cents
     FROM voice_candidates c JOIN voice_roles r ON r.id=c.role_id WHERE r.project_id=$1 ORDER BY c.n DESC`, [id]);
  // The approved face for each role's portrait, if visual approvals have one.
  const portraits = await q(
    `SELECT i.key, (SELECT im.file_sha FROM visual_images im WHERE im.version_id=i.approved_version_id
                    ORDER BY (im.view='face') DESC, (im.view='reference') DESC LIMIT 1) AS file_sha
     FROM visual_items i WHERE i.project_id=$1 AND i.approved_version_id IS NOT NULL`, [id]);
  const pronunciations = await q("SELECT id, written, say_as, note, active FROM pronunciations WHERE project_id=$1 ORDER BY active DESC, written", [id]);
  const job = await one("SELECT status, error FROM jobs WHERE project_id=$1 AND type='voices.plan' ORDER BY created_at DESC LIMIT 1", [id]);
  const failures = await q(
    `SELECT j.payload->>'roleId' AS role_id, j.error FROM jobs j WHERE j.project_id=$1 AND j.type='voices.design' AND j.status='failed'
     AND j.created_at > now() - interval '1 hour' ORDER BY j.created_at DESC`, [id]);
  const spent = await one<{ c: string }>("SELECT COALESCE(SUM(cents),0) AS c FROM spend WHERE project_id=$1", [id]);
  return NextResponse.json({
    status: p.voices_status, roles, candidates, portraits, pronunciations, planJob: job, failures,
    provider: { name: voiceProvider(), designModel: DESIGN_MODEL, ttsModel: TTS_MODEL }, spentCents: Number(spent!.c),
  });
}
