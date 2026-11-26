import { NextResponse } from "next/server";
import { q, one, logEvent } from "@/lib/db";
import type { Intake } from "@/lib/intakeSchema";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const project = await one("SELECT id, name, step, status, created_at, updated_at FROM projects WHERE id=$1", [id]);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [documents, sections, intake, job] = await Promise.all([
    q("SELECT id, idx, filename, kind, bytes FROM source_documents WHERE project_id=$1 ORDER BY idx", [id]),
    q(
      `SELECT s.ref, d.idx AS doc, s.level, s.heading, s.path, s.start_line, s.end_line, s.kind, s.text
       FROM source_sections s JOIN source_documents d ON d.id=s.document_id WHERE s.project_id=$1`,
      [id],
    ),
    one("SELECT summary, warnings, backend, model, updated_at FROM intake WHERE project_id=$1", [id]),
    one("SELECT status, error, attempts FROM jobs WHERE project_id=$1 AND type='intake.extract' ORDER BY created_at DESC LIMIT 1", [id]),
  ]);
  const order = (r: string) => r.split(":s").map((x) => Number(x.replace("d", "")));
  sections.sort((a, b) => order(a.ref)[0] - order(b.ref)[0] || order(a.ref)[1] - order(b.ref)[1]);
  return NextResponse.json({ project, documents, sections, intake, job });
}

/** Autosave: the edited summary and/or the current step. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = (await req.json()) as { summary?: Intake; step?: number };
  if (body.summary) {
    const s = body.summary;
    if (typeof s !== "object" || !s.series || !Array.isArray(s.episodes) || !Array.isArray(s.characters)) {
      return NextResponse.json({ error: "summary is malformed" }, { status: 400 });
    }
    const r = await q("UPDATE intake SET summary=$2, updated_at=now() WHERE project_id=$1 RETURNING project_id", [id, JSON.stringify(s)]);
    if (!r.length) return NextResponse.json({ error: "nothing to save yet" }, { status: 409 });
    await q("UPDATE projects SET name=$2, updated_at=now() WHERE id=$1", [id, s.series.title || "Untitled series"]);
  }
  if (body.step !== undefined) {
    const step = Number(body.step);
    if (!Number.isInteger(step) || step < 1 || step > 5) return NextResponse.json({ error: "bad step" }, { status: 400 });
    if (step > 1) {
      const row = await one<{ summary: Intake }>("SELECT summary FROM intake WHERE project_id=$1", [id]);
      const open = row?.summary.conflicts.filter((c) => c.severity === "changes_production" && !c.resolution) ?? [];
      if (!row) return NextResponse.json({ error: "The sources have not been read yet." }, { status: 409 });
      if (open.length) return NextResponse.json({ error: `Resolve ${open.length} conflict(s) that change production first.` }, { status: 409 });
    }
    await q("UPDATE projects SET step=$2, updated_at=now() WHERE id=$1", [id, step]);
    await logEvent(id, "project.step", { step });
  }
  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}
