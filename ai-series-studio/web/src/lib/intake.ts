import { q, tx, logEvent } from "./db";
import { runStructured, NoModelAvailable } from "./llm";
import { renderForModel, type Section } from "./sources";
import { INTAKE_PARTS, INTAKE_SYSTEM, normalizeIntake, type Intake } from "./intakeSchema";

type DocRow = { id: string; idx: number; filename: string; kind: string };
type SecRow = { ref: string; document_id: string; level: number; heading: string; path: string[]; start_line: number; end_line: number; text: string };

export async function buildIntakeInput(projectId: string) {
  const docs = await q<DocRow>("SELECT id, idx, filename, kind FROM source_documents WHERE project_id=$1 ORDER BY idx", [projectId]);
  const secs = await q<SecRow>(
    "SELECT ref, document_id, level, heading, path, start_line, end_line, text FROM source_sections WHERE project_id=$1",
    [projectId],
  );
  const order = (ref: string) => ref.split(":s").map((x) => Number(x.replace("d", "")));
  secs.sort((a, b) => order(a.ref)[0] - order(b.ref)[0] || order(a.ref)[1] - order(b.ref)[1]);
  const input = renderForModel(
    docs.map((d) => ({
      idx: d.idx,
      filename: d.filename,
      kind: d.kind,
      sections: secs
        .filter((s) => s.document_id === d.id)
        .map<Section>((s) => ({ ref: s.ref, level: s.level, heading: s.heading, path: s.path, startLine: s.start_line, endLine: s.end_line, text: s.text })),
    })),
  );
  return { input, refs: new Set(secs.map((s) => s.ref)) };
}

/** Drop citations of sections that do not exist, and say so. */
function checkRefs(x: Intake, refs: Set<string>) {
  const warnings: string[] = [];
  const clean = (list: string[], where: string) =>
    list.filter((r) => {
      if (refs.has(r)) return true;
      warnings.push(`${where} cited ${r}, which is not in the sources; removed.`);
      return false;
    });
  x.series.sources = clean(x.series.sources, "Series");
  x.episodes.forEach((e) => {
    e.sources = clean(e.sources, `Episode ${e.number}`);
    e.script.sections = clean(e.script.sections, `Episode ${e.number} script`);
  });
  x.characters.forEach((c) => {
    c.sources = clean(c.sources, c.name);
    c.ages.forEach((a) => (a.sources = clean(a.sources, `${c.name}'s age`)));
  });
  x.locations.forEach((l) => (l.sources = clean(l.sources, l.name)));
  x.props.forEach((p) => (p.sources = clean(p.sources, p.name)));
  x.production_requirements.forEach((r) => (r.sources = clean(r.sources, "A requirement")));
  x.conflicts.forEach((c) => c.options.forEach((o) => (o.sources = clean(o.sources, `Conflict ${c.id}`))));
  x.section_kinds = x.section_kinds.filter((k) => refs.has(k.ref));
  return warnings;
}

export async function runIntake(projectId: string) {
  await q("UPDATE projects SET status='extracting', updated_at=now() WHERE id=$1", [projectId]);
  const { input, refs } = await buildIntakeInput(projectId);
  let res: { data: Record<string, unknown>; backend: "api" | "recorded"; model: string | null; inputHash: string };
  try {
    const call = (p: (typeof INTAKE_PARTS)[number]) =>
      runStructured<Record<string, unknown>>({
        role: `intake.${p.name}`, system: INTAKE_SYSTEM, input, instruction: p.instruction, schema: p.schema, projectId,
      });
    // The first call writes the prompt cache; the other two read it.
    const first = await call(INTAKE_PARTS[0]);
    const rest = await Promise.all(INTAKE_PARTS.slice(1).map(call));
    const all = [first, ...rest];
    res = {
      data: Object.assign({}, ...all.map((r) => r.data)),
      backend: all.every((r) => r.backend === "recorded") ? "recorded" : "api",
      model: first.model,
      inputHash: first.inputHash,
    };
  } catch (e) {
    await q("UPDATE projects SET status='intake_failed', updated_at=now() WHERE id=$1", [projectId]);
    await logEvent(projectId, "intake.failed", { error: String(e) });
    throw Object.assign(e as Error, { retryable: !(e instanceof NoModelAvailable) });
  }
  const extraction = res.data;
  const summary: Intake = normalizeIntake(structuredClone(extraction));
  summary.conflicts.forEach((c) => (c.resolution = null));
  const warnings = checkRefs(summary, refs);
  // PDF text extraction often scrambles Devanagari letter order.
  const pdfs = await q<{ idx: number; filename: string; text: string }>(
    "SELECT idx, filename, text FROM source_documents WHERE project_id=$1 AND lower(filename) LIKE '%.pdf'", [projectId]);
  for (const d of pdfs) {
    if (/[\u0900-\u097F]/.test(d.text)) {
      warnings.unshift(`d${d.idx} (${d.filename}) is a PDF with Devanagari text. PDF extraction can put Hindi letters out of order, so check dialogue from this file, or upload a Markdown or text version.`);
    }
  }
  await tx(async (c) => {
    await c.query(
      `INSERT INTO intake (project_id, extraction, summary, warnings, backend, model, input_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (project_id) DO UPDATE SET extraction=excluded.extraction, summary=excluded.summary,
         warnings=excluded.warnings, backend=excluded.backend, model=excluded.model, input_hash=excluded.input_hash, updated_at=now()`,
      [projectId, JSON.stringify(extraction), JSON.stringify(summary), JSON.stringify(warnings), res.backend, res.model, res.inputHash],
    );
    for (const k of summary.section_kinds) {
      await c.query("UPDATE source_sections SET kind=$3 WHERE project_id=$1 AND ref=$2", [projectId, k.ref, k.kind]);
    }
    await c.query("UPDATE projects SET status='intake_ready', name=$2, updated_at=now() WHERE id=$1", [projectId, summary.series.title]);
  });
  await logEvent(projectId, "intake.ready", { backend: res.backend, warnings: warnings.length });
}
