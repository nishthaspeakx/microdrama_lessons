"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SourceDrawer, { SourceChips } from "./SourceDrawer";
import { KIND_LABEL, KIND_STYLE, type Intake, type ProjectData } from "./types";

type Save = "saved" | "saving" | "unsaved" | "error";
const field = "w-full rounded-lg border border-line bg-white px-3 py-2 outline-none focus:border-accent [field-sizing:content] resize-none";

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">{children}</span>;
}

export default function IntakeReview({ data, onContinue }: { data: ProjectData; onContinue: () => Promise<string | null> }) {
  const [s, setS] = useState<Intake>(() => data.intake!.summary);
  const [save, setSave] = useState<Save>("saved");
  const [drawer, setDrawer] = useState<{ refs: string[]; title?: string } | null>(null);
  const [openDoc, setOpenDoc] = useState<number | null>(null);
  const [continueError, setContinueError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sections = useMemo(() => new Map(data.sections.map((x) => [x.ref, x])), [data.sections]);
  const open = (refs: string[], title?: string) => setDrawer({ refs, title });

  const persist = useCallback(async (next: Intake) => {
    setSave("saving");
    const r = await fetch(`/api/projects/${data.project.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ summary: next }),
    });
    setSave(r.ok ? "saved" : "error");
  }, [data.project.id]);

  // Autosave 700 ms after the last edit.
  const update = (fn: (draft: Intake) => void) => {
    setS((prev) => {
      const next: Intake = structuredClone(prev);
      fn(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => persist(next), 700);
      return next;
    });
    setSave("unsaved");
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const blocking = s.conflicts.filter((c) => c.severity === "changes_production" && !c.resolution);
  const byCategory = s.production_requirements.reduce<Record<string, number[]>>((acc, r, i) => {
    (acc[r.category] ??= []).push(i);
    return acc;
  }, {});
  const kindsByDoc = (idx: number) => {
    const counts: Record<string, number> = {};
    data.sections.filter((x) => x.doc === idx).forEach((x) => { counts[x.kind ?? "other"] = (counts[x.kind ?? "other"] ?? 0) + 1; });
    return counts;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        {data.intake!.backend === "recorded" && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            This summary was replayed from a recorded reading of these exact files, because no Anthropic API key is set. Add a key to read new sources live.
          </p>
        )}
        {data.intake!.warnings.length > 0 && (
          <details className="rounded-xl border border-line bg-white p-3 text-sm">
            <summary className="cursor-pointer text-muted">{data.intake!.warnings.length} note{data.intake!.warnings.length === 1 ? "" : "s"} about the sources</summary>
            <ul className="mt-2 list-disc pl-5 text-muted">{data.intake!.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </details>
        )}

        <Card title="Series" right={<SourceChips refs={s.series.sources} sections={sections} onOpen={(r) => open(r)} />}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2"><Label>Title</Label>
              <input className={`${field} deva text-lg font-semibold`} value={s.series.title} onChange={(e) => update((d) => { d.series.title = e.target.value; })} /></label>
            <label className="sm:col-span-2"><Label>Logline</Label>
              <textarea rows={2} className={field} value={s.series.logline} onChange={(e) => update((d) => { d.series.logline = e.target.value; })} /></label>
            <label><Label>Episodes</Label>
              <input type="number" min={1} className={field} value={s.series.episode_count} onChange={(e) => update((d) => { d.series.episode_count = Number(e.target.value); })} /></label>
            <label><Label>Language</Label>
              <input className={field} value={s.series.language} onChange={(e) => update((d) => { d.series.language = e.target.value; })} /></label>
            <label><Label>Setting</Label>
              <textarea rows={2} className={field} value={s.series.setting} onChange={(e) => update((d) => { d.series.setting = e.target.value; })} /></label>
            <label><Label>Era</Label>
              <textarea rows={2} className={field} value={s.series.era} onChange={(e) => update((d) => { d.series.era = e.target.value; })} /></label>
            <label><Label>Dialogue written in</Label>
              <textarea rows={1} className={field} value={s.series.dialogue_script} onChange={(e) => update((d) => { d.series.dialogue_script = e.target.value; })} /></label>
            <label><Label>Tone</Label>
              <textarea rows={1} className={field} value={s.series.tone} onChange={(e) => update((d) => { d.series.tone = e.target.value; })} /></label>
            <p className="text-sm text-muted sm:col-span-2">
              Format: {[s.series.format.aspect_ratio, s.series.format.fps && `${s.series.format.fps} fps`, s.series.format.episode_length].filter(Boolean).join(" · ") || "not stated"}
            </p>
          </div>
        </Card>

        <Card title={`Episodes (${s.episodes.length})`}>
          <ol className="space-y-4">
            {s.episodes.map((e, i) => (
              <li key={e.number} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold text-accent">Episode {e.number}</span>
                  <span className="deva font-semibold">{e.title}</span>
                  {e.title_en && <span className="text-sm text-muted">{e.title_en}</span>}
                  {e.runtime && <span className="text-sm text-muted">· {e.runtime}</span>}
                </div>
                <textarea rows={3} className={`${field} mt-3 text-sm`} value={e.summary} onChange={(ev) => update((d) => { d.episodes[i].summary = ev.target.value; })} />
                {e.ends_on && <p className="mt-2 text-sm"><span className="text-muted">Ends on: </span>{e.ends_on}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  {e.script.status === "screenplay" ? (
                    <button onClick={() => open(e.script.sections, `Episode ${e.number} screenplay`)}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800 hover:border-emerald-400">
                      Screenplay found · {e.script.sections.length} section{e.script.sections.length === 1 ? "" : "s"} · View
                    </button>
                  ) : (
                    <span className="rounded-full border border-line bg-stone-50 px-3 py-1 text-muted">
                      {e.script.status === "outline" ? "Outline only: a draft screenplay will be written" : "No script in the sources"}
                    </span>
                  )}
                  {e.script.note && <span className="text-muted">{e.script.note}</span>}
                  <SourceChips refs={e.sources} sections={sections} onOpen={(r) => open(r)} />
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card title={`Characters (${s.characters.length})`}>
          <div className="grid gap-4 md:grid-cols-2">
            {s.characters.map((c, i) => (
              <div key={c.key} className="rounded-xl border border-line p-4">
                <div className="flex items-center gap-2">
                  <input className={`${field} font-semibold`} value={c.name} onChange={(e) => update((d) => { d.characters[i].name = e.target.value; })} />
                  {c.speaks && <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">Speaks</span>}
                </div>
                <p className="mt-2 text-sm text-muted">{c.role}{c.first_episode ? ` · from Episode ${c.first_episode}` : ""}</p>
                {c.ages.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {c.ages.map((a, j) => (
                      <li key={j}>
                        <span className="text-muted">{a.period}:</span> {a.age} <SourceChips refs={a.sources} sections={sections} onOpen={(r) => open(r)} />
                      </li>
                    ))}
                  </ul>
                )}
                <textarea rows={3} className={`${field} mt-3 text-sm`} value={c.description} onChange={(e) => update((d) => { d.characters[i].description = e.target.value; })} />
                {c.relationships.length > 0 && (
                  <p className="mt-2 text-sm text-muted">{c.relationships.map((r) => `${r.relation} ${r.with}`).join(" · ")}</p>
                )}
                <div className="mt-2"><SourceChips refs={c.sources} sections={sections} onOpen={(r) => open(r)} /></div>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card title={`Locations (${s.locations.length})`}>
            <ul className="space-y-3 text-sm">
              {s.locations.map((l, i) => (
                <li key={l.key}>
                  <p className="font-medium">{l.name} {l.episodes.length > 0 && <span className="font-normal text-muted">· Ep {l.episodes.join(", ")}</span>}</p>
                  <textarea rows={2} className={`${field} mt-1`} value={l.description} onChange={(e) => update((d) => { d.locations[i].description = e.target.value; })} />
                </li>
              ))}
            </ul>
          </Card>
          <Card title={`Props and vehicles (${s.props.length})`}>
            <ul className="space-y-3 text-sm">
              {s.props.map((p, i) => (
                <li key={p.key}>
                  <p className="font-medium">{p.name}</p>
                  <textarea rows={2} className={`${field} mt-1`} value={p.description} onChange={(e) => update((d) => { d.props[i].description = e.target.value; })} />
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card title="Production requirements">
          <div className="space-y-4">
            {Object.entries(byCategory).map(([cat, idxs]) => (
              <div key={cat}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{cat}</p>
                <ul className="space-y-2">
                  {idxs.map((i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <textarea rows={2} className={field} value={s.production_requirements[i].text}
                        onChange={(e) => update((d) => { d.production_requirements[i].text = e.target.value; })} />
                      <SourceChips refs={s.production_requirements[i].sources.slice(0, 2)} sections={sections} onOpen={(r) => open(r)} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <Card title="Conflicts" right={<span className={`rounded-full px-2 py-0.5 text-xs ${blocking.length ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{blocking.length ? `${blocking.length} to resolve` : "All resolved"}</span>}>
          {s.conflicts.length === 0 && <p className="text-sm text-muted">The sources agree with each other.</p>}
          <ul className="space-y-4">
            {s.conflicts.map((c, i) => (
              <li key={c.id} className={`rounded-xl border p-3 ${c.resolution ? "border-line" : c.severity === "changes_production" ? "border-red-200 bg-red-50/40" : "border-line"}`}>
                <p className="text-sm font-semibold">{c.topic}</p>
                <p className="mt-1 text-sm text-muted">{c.description}</p>
                <fieldset className="mt-3 space-y-2">
                  <legend className="sr-only">Choose for {c.topic}</legend>
                  {c.options.map((o, j) => (
                    <label key={j} className="flex items-start gap-2 text-sm">
                      <input type="radio" name={`c-${c.id}`} aria-label={o.value} className="mt-1 accent-[var(--color-accent)]" checked={c.resolution?.choice === j}
                        onChange={() => update((d) => { d.conflicts[i].resolution = { choice: j, note: d.conflicts[i].resolution?.note ?? "" }; })} />
                      <span className="deva">{o.value} <SourceChips refs={o.sources} sections={sections} onOpen={(r) => open(r)} /></span>
                    </label>
                  ))}
                  <label className="flex items-start gap-2 text-sm">
                    <input type="radio" name={`c-${c.id}`} aria-label="Something else" className="mt-1 accent-[var(--color-accent)]" checked={c.resolution?.choice === null}
                      onChange={() => update((d) => { d.conflicts[i].resolution = { choice: null, note: d.conflicts[i].resolution?.note ?? "" }; })} />
                    <span>Something else</span>
                  </label>
                  {c.resolution?.choice === null && (
                    <textarea rows={2} className={`${field} text-sm`} placeholder="What should we do?" value={c.resolution.note}
                      onChange={(e) => update((d) => { d.conflicts[i].resolution = { choice: null, note: e.target.value }; })} />
                  )}
                </fieldset>
                {c.recommendation && <p className="mt-2 text-xs text-muted">Suggestion: {c.recommendation}</p>}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Sources">
          <ul className="space-y-3 text-sm">
            {data.documents.map((d) => {
              const counts = kindsByDoc(d.idx);
              return (
                <li key={d.id}>
                  <button onClick={() => setOpenDoc(openDoc === d.idx ? null : d.idx)} className="w-full text-left">
                    <p className="font-medium">d{d.idx} · {d.filename}</p>
                    <p className="mt-1 flex flex-wrap gap-1">
                      {Object.entries(counts).map(([k, n]) => (
                        <span key={k} className={`rounded border px-1.5 py-0.5 text-[11px] ${KIND_STYLE[k] ?? KIND_STYLE.other}`}>{KIND_LABEL[k] ?? k} {n}</span>
                      ))}
                    </p>
                  </button>
                  {openDoc === d.idx && (
                    <ul className="mt-2 space-y-1 border-l border-line pl-3">
                      {data.sections.filter((x) => x.doc === d.idx).map((x) => (
                        <li key={x.ref}>
                          <button onClick={() => open([x.ref])} className="text-left hover:text-accent">
                            <span className="text-muted">{x.ref}</span> <span className="deva">{x.heading}</span>
                            {x.kind && <span className={`ml-1 rounded border px-1 text-[10px] ${KIND_STYLE[x.kind]}`}>{KIND_LABEL[x.kind]}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-muted" aria-live="polite">
            {save === "saved" ? "All changes saved" : save === "saving" ? "Saving…" : save === "unsaved" ? "Unsaved changes" : "Could not save. Check your connection."}
          </p>
          <button
            disabled={blocking.length > 0 || save !== "saved"}
            onClick={async () => setContinueError(await onContinue())}
            className="mt-3 w-full rounded-full bg-accent px-5 py-3 font-semibold text-white disabled:opacity-40"
          >
            Continue to visual approvals
          </button>
          {blocking.length > 0 && <p className="mt-2 text-xs text-muted">Resolve the conflicts that change production first.</p>}
          {continueError && <p className="mt-2 text-xs text-red-700">{continueError}</p>}
        </div>
      </aside>

      {drawer && <SourceDrawer refs={drawer.refs} data={data} title={drawer.title} onClose={() => setDrawer(null)} />}
    </div>
  );
}
