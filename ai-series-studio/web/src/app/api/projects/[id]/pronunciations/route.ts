import { q } from "@/lib/db";
import { bad, guard, UUID } from "@/lib/api";
import { cleanSayAs } from "@/lib/voices";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

/** Add or update a pronunciation note. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!UUID.test(id)) return bad("not found", 404);
  const { written, say_as, note } = (await req.json()) as { written?: string; say_as?: string; note?: string };
  if (!written?.trim() || !say_as?.trim()) return bad("Give the word as written and how it should sound.");
  const clean = cleanSayAs(say_as, note ?? null);
  if (!clean.say_as) return bad("Say-as needs the respelling itself, outside brackets.");
  return guard(async () => {
    await q(
      `INSERT INTO pronunciations (project_id, written, say_as, note) VALUES ($1,$2,$3,$4)
       ON CONFLICT (project_id, written) DO UPDATE SET say_as=excluded.say_as, note=excluded.note, active=true`,
      [id, written.trim(), clean.say_as, clean.note]);
    return { ok: true };
  });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const pid = new URL(req.url).searchParams.get("pid") ?? "";
  if (!UUID.test(id) || !UUID.test(pid)) return bad("not found", 404);
  return guard(async () => {
    await q("DELETE FROM pronunciations WHERE project_id=$1 AND id=$2", [id, pid]);
    return { ok: true };
  });
}

/** Turn a note on or off. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { pid, active } = (await req.json()) as { pid?: string; active?: boolean };
  if (!UUID.test(id) || !pid || !UUID.test(pid)) return bad("not found", 404);
  return guard(async () => {
    await q("UPDATE pronunciations SET active=$3 WHERE project_id=$1 AND id=$2", [id, pid, !!active]);
    return { ok: true };
  });
}
