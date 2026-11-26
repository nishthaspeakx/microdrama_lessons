import { NextResponse } from "next/server";
import { q, tx, logEvent } from "@/lib/db";
import { putFile, sha256 } from "@/lib/storage";
import { ACCEPTED, MAX_FILE_BYTES, extOf, fileToText, sectionize } from "@/lib/sources";
import { enqueue } from "@/lib/jobs";

export const runtime = "nodejs";

export async function GET() {
  const rows = await q(
    `SELECT p.id, p.name, p.step, p.status, p.updated_at,
            (SELECT count(*)::int FROM source_documents d WHERE d.project_id=p.id) AS documents
     FROM projects p ORDER BY p.updated_at DESC LIMIT 50`,
  );
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const brief = String(form.get("brief") ?? "").trim();
  if (!files.length && !brief) {
    return NextResponse.json({ error: "Upload at least one file or tell us about your series." }, { status: 400 });
  }
  for (const f of files) {
    if (!ACCEPTED.includes(extOf(f.name))) return NextResponse.json({ error: `${f.name}: use Markdown, PDF or plain text.` }, { status: 400 });
    if (f.size > MAX_FILE_BYTES) return NextResponse.json({ error: `${f.name} is larger than 15 MB.` }, { status: 400 });
  }

  // Parse everything before writing anything, so a bad file creates no half project.
  const docs: { name: string; kind: string; mime: string | null; buf: Buffer; text: string; key: string | null }[] = [];
  for (const f of files) {
    const buf = Buffer.from(await f.arrayBuffer());
    let text: string;
    try {
      text = await fileToText(f.name, buf);
    } catch (e) {
      return NextResponse.json({ error: `${f.name}: ${(e as Error).message}` }, { status: 400 });
    }
    if (!text.trim()) return NextResponse.json({ error: `${f.name} has no readable text.` }, { status: 400 });
    const { key } = await putFile(buf, extOf(f.name));
    docs.push({ name: f.name, kind: "upload", mime: f.type || null, buf, text, key });
  }
  if (brief) docs.push({ name: "Typed brief", kind: "typed_brief", mime: "text/plain", buf: Buffer.from(brief), text: brief, key: null });

  const name = files[0]?.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") ?? "New series";
  const id = await tx(async (c) => {
    const p = await c.query<{ id: string }>("INSERT INTO projects (name, status) VALUES ($1, 'extracting') RETURNING id", [name]);
    const pid = p.rows[0].id;
    for (const [i, d] of docs.entries()) {
      const idx = i + 1;
      const doc = await c.query<{ id: string }>(
        "INSERT INTO source_documents (project_id, idx, filename, kind, mime, sha256, bytes, storage_key, text) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",
        [pid, idx, d.name, d.kind, d.mime, sha256(d.buf), d.buf.length, d.key, d.text],
      );
      const fname = d.kind === "typed_brief" ? "brief.txt" : d.name;
      const sections = d.kind === "typed_brief"
        ? [{ ref: `d${idx}:s1`, level: 1, heading: "Typed brief", path: [], startLine: 1, endLine: d.text.split("\n").length, text: d.text }]
        : sectionize(idx, fname, d.text);
      for (const s of sections) {
        await c.query(
          "INSERT INTO source_sections (project_id, ref, document_id, level, heading, path, start_line, end_line, text) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [pid, s.ref, doc.rows[0].id, s.level, s.heading, s.path, s.startLine, s.endLine, s.text],
        );
      }
    }
    return pid;
  });
  await enqueue("intake.extract", id);
  await logEvent(id, "project.created", { documents: docs.map((d) => ({ name: d.name, kind: d.kind })) });
  return NextResponse.json({ id }, { status: 201 });
}
