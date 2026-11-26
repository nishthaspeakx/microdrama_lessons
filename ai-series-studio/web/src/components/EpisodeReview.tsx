"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type MapEntry = { clip_id: string; take_id: string; n: number; scene: number; start: number; end: number; trim_start: number; lines: { id: string; start: number; end: number }[] };
type Cut = {
  id: string; n: number; video_sha: string; srt_sha: string | null; seconds: number; markers: { scene: number; title: string; start: number }[];
  clip_map: MapEntry[]; changes: { start: number; end: number; label: string; joins_sha?: string }[]; revision_id: string | null; base_cut_id: string | null; created_at: string;
};
type Note = { id: string; cut_id: string; cut_n: number; t_start: number; t_end: number | null; final_shot: boolean; text: string; status: string; revision_id: string | null };
type Instr = {
  note_id: string; kind: string; understood: string; clip_n: number; line_id: string; new_devanagari: string; new_english: string; prompt: string;
  duration_s: number; sfx_description: string; at_s: number; volume: number; level: number; from_s: number; to_s: number; trim_start_s: number; trim_end_s: number;
  est_cents?: number; affects?: number[];
};
type Revision = { id: string; base_cut_id: string; status: string; plan: Instr[]; user_edited: boolean; result_cut_id: string | null; progress: string | null; error: string | null };
type Data = {
  episodes: { number: number; title: string }[];
  episode: { id: string; number: number; title: string; settings: { width: number; height: number }; current_cut_id: string; status: string } | null;
  cuts: Cut[]; notes: Note[]; revisions: Revision[]; lines: { id: string; scene: number; devanagari: string; english: string }[]; spentCents: number;
};

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
const file = (sha: string) => `/api/files/${sha}`;
const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
const KIND: Record<string, { label: string; tone: string }> = {
  trim: { label: "Trim", tone: "bg-emerald-50 text-emerald-800" }, ambience: { label: "Sound level", tone: "bg-emerald-50 text-emerald-800" },
  mute: { label: "Mute", tone: "bg-emerald-50 text-emerald-800" }, sfx: { label: "Sound effect", tone: "bg-sky-50 text-sky-800" },
  line_text: { label: "New line + lip-sync", tone: "bg-amber-50 text-amber-900" }, footage: { label: "New footage", tone: "bg-amber-50 text-amber-900" },
  none: { label: "Cannot do", tone: "bg-stone-100 text-muted" },
};

async function call(url: string, method = "POST", body?: unknown) {
  const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Something went wrong.");
  return j;
}

export default function EpisodeReview({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const [d, setD] = useState<Data | null>(null);
  const [cutId, setCutId] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const [now, setNow] = useState(0);
  const [time, setTime] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const player = useRef<HTMLVideoElement>(null);
  const other = useRef<HTMLVideoElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/projects/${projectId}/review`, { cache: "no-store" });
    if (r.ok) setD(await r.json());
  }, [projectId]);
  useEffect(() => { load(); }, [load]);
  const rev = d?.revisions[0] ?? null;
  const active = rev?.status === "planning" || rev?.status === "applying";
  useEffect(() => {
    if (!active) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [active, load]);
  // When an edit finishes, show the new version.
  const lastApplied = useRef<string | null>(null);
  useEffect(() => {
    if (rev?.status === "applied" && rev.result_cut_id && lastApplied.current !== rev.result_cut_id) {
      if (lastApplied.current !== null) { setCutId(rev.result_cut_id); setCompare(true); }
      lastApplied.current = rev.result_cut_id;
    } else if (lastApplied.current === null) lastApplied.current = rev?.result_cut_id ?? "";
  }, [rev?.status, rev?.result_cut_id]);

  const act = async (label: string, fn: () => Promise<unknown>, after?: (r: unknown) => void) => {
    setBusy(label);
    setMsg(null);
    try { const r = await fn(); after?.(r); await load(); }
    catch (e) { setMsg({ kind: "error", text: (e as Error).message }); }
    finally { setBusy(null); }
  };

  const cut = useMemo(() => d?.cuts.find((c) => c.id === (cutId ?? d?.episode?.current_cut_id)) ?? d?.cuts[d.cuts.length - 1] ?? null, [d, cutId]);
  const base = useMemo(() => (cut?.base_cut_id ? d?.cuts.find((c) => c.id === cut.base_cut_id) ?? null : null), [d, cut]);

  if (!d) return <p className="text-muted">Loading…</p>;
  if (!d.episode || !cut) {
    return (
      <div className="rounded-2xl border border-line bg-white p-8">
        <p className="text-lg font-semibold">Review & export</p>
        <p className="mt-2 text-muted">Assemble an episode in step 4 first; it opens here for timestamped notes.</p>
        <button onClick={onBack} className="mt-4 rounded-full border border-line px-5 py-2 hover:border-stone-400">Back to the episode</button>
      </div>
    );
  }
  const ep = d.episode;
  const seek = (t: number, play = false) => {
    if (!player.current) return;
    player.current.currentTime = Math.max(0, t);
    if (play) player.current.play();
  };
  const open = d.notes.filter((n) => n.status === "open" || n.status === "planned");
  const done = d.notes.filter((n) => n.status === "applied");
  const pins = d.notes.filter((n) => n.cut_id === cut.id);
  const aspect = `${ep.settings.width}/${ep.settings.height}`;
  const planCost = rev?.status === "planned" ? rev.plan.reduce((a, i) => a + (i.est_cents ?? 0), 0) : 0;
  const savePlan = (plan: Instr[]) => act("plan", () => call(`/api/revisions/${rev!.id}`, "PATCH", { plan }));
  // The same moment in the version this one revised: the same clip, the same offset into it.
  const baseTimeFor = (t: number) => {
    if (!base) return t;
    const m = cut.clip_map.find((x) => t >= x.start && t < x.end) ?? cut.clip_map[cut.clip_map.length - 1];
    const b = base.clip_map.find((x) => x.clip_id === m.clip_id);
    return b ? Math.min(b.start + (t - m.start) + (m.trim_start - b.trim_start), b.end - 0.05) : t;
  };
  const playBoth = (t: number) => {
    seek(t, true);
    if (other.current) { other.current.currentTime = baseTimeFor(t); other.current.play(); }
  };

  return (
    <div className="space-y-4">
      <div className="studio-stage-bar">
        <h2 className="studio-stage-title deva">Review · Episode {ep.number} · {ep.title}</h2>
        <label className="flex items-center gap-2 text-sm">Version
          <select value={cut.id} onChange={(e) => { setCutId(e.target.value); setCompare(false); }} className="rounded-full border border-line bg-white px-3 py-1.5">
            {d.cuts.map((c) => <option key={c.id} value={c.id}>v{c.n}{c.id === ep.current_cut_id ? " · newest" : ""}{c.revision_id ? " · edited" : " · assembled"}</option>)}
          </select>
        </label>
        <span className="text-line">|</span>
        <p className="text-sm text-muted">{fmt(cut.seconds)} long</p>
        <span className="text-line">|</span>
        <p className="text-sm text-muted">Spent {usd(d.spentCents)} on this project</p>
        <div className="ml-auto flex gap-2">
          <a href={`${file(cut.video_sha)}?download=episode-${ep.number}-v${cut.n}.mp4`} className="rounded-full border border-line px-4 py-1.5 text-sm hover:border-stone-400">Download MP4</a>
          {cut.srt_sha && <a href={`${file(cut.srt_sha)}?download=episode-${ep.number}-v${cut.n}.srt`} className="rounded-full border border-line px-4 py-1.5 text-sm hover:border-stone-400">Download subtitles</a>}
        </div>
      </div>
      {msg && <p className={`rounded-xl p-3 text-sm ${msg.kind === "error" ? "bg-red-50 text-red-800" : "bg-sky-50 text-sky-900"}`}>{msg.text}</p>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        {/* Player, timeline, versions */}
        <section className="studio-review-panel space-y-3" aria-label="Player">
          <div className={`flex items-start justify-center gap-3 ${compare && base ? "flex-nowrap" : "flex-wrap"}`}>
            {compare && base && (
              <figure className="min-w-0 max-w-[48%] flex-1 text-center">
                <video ref={other} controls preload="metadata" src={file(base.video_sha)} className="max-h-[62vh] w-full rounded-xl bg-black" style={{ aspectRatio: aspect }} />
                <figcaption className="mt-1 text-xs text-muted">Before · v{base.n}</figcaption>
              </figure>
            )}
            <figure className={compare && base ? "min-w-0 max-w-[48%] flex-1 text-center" : "text-center"}>
              <video ref={player} controls preload="metadata" src={file(cut.video_sha)} onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
                className={`max-h-[62vh] rounded-xl bg-black ${compare && base ? "w-full" : ""}`} style={{ aspectRatio: aspect }} />
              <figcaption className="mt-1 text-xs text-muted">{compare && base ? "After" : "Watching"} · v{cut.n}</figcaption>
            </figure>
          </div>

          <Timeline cut={cut} now={now} pins={pins} onSeek={(t) => seek(t)} />

          {cut.changes.length > 0 && (
            <div className="rounded-xl border border-line p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">Changes in v{cut.n}{base ? ` from v${base.n}` : ""}</p>
                {base && <button onClick={() => setCompare(!compare)} className="ml-auto rounded-full border border-line px-3 py-1 text-xs hover:border-stone-400">{compare ? "Hide the earlier version" : `Compare with v${base.n}`}</button>}
              </div>
              <ol className="mt-2 space-y-2">
                {cut.changes.map((c, i) => (
                  <li key={i} className="flex flex-wrap items-start gap-2">
                    <button onClick={() => (compare ? playBoth(c.start) : seek(c.start, true))} className="tabular-nums text-accent hover:underline">{fmt(c.start)}</button>
                    <span className="min-w-0 flex-1">{c.label}</span>
                    {c.joins_sha && (
                      <figure className="w-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={file(c.joins_sha)} alt="Frames either side of both joins" className="max-h-28 rounded-lg" />
                        <figcaption className="text-xs text-muted">Check the joins: last frame before, first frame of the new clip, its last frame, the first frame after.</figcaption>
                      </figure>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        {/* Notes and the edit plan */}
        <section className="space-y-4" aria-label="Edit notes">
          <div className="studio-review-panel">
            <p className="font-semibold">Leave a note</p>
            <p className="text-sm text-muted">Times are on the version you are watching (v{cut.n}). Use seconds (12), minutes (0:12), a range (0:12-0:15), or the final shot.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="0:12 or 0:12-0:15" aria-label="Time"
                className="w-40 rounded-full border border-line px-3 py-1.5 text-sm outline-none focus:border-accent" />
              <button onClick={() => {
                const t = fmt(player.current?.currentTime ?? 0);
                setTime((cur) => (/^\d+(:\d+(\.\d+)?)?$/.test(cur.trim()) && cur.trim() !== t ? `${cur.trim()}-${t}` : t));
              }} className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-stone-400">Use current time</button>
              <button onClick={() => setTime("final shot")} className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-stone-400">Final shot</button>
            </div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="What should change? e.g. add the clink of a plate as he sets the jaggery down"
              className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent" aria-label="Note" />
            <button disabled={!time.trim() || !text.trim() || !!busy}
              onClick={() => act("note", () => call(`/api/episodes/${ep.id}/notes`, "POST", { cutId: cut.id, time, text }), () => { setTime(""); setText(""); })}
              className="mt-2 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40">Add note</button>
          </div>

          <div className="studio-review-panel">
            <div className="flex items-center gap-2">
              <p className="font-semibold">Notes · {open.length} open</p>
              <button disabled={!open.length || !!busy || active} onClick={() => act("plan", () => call(`/api/episodes/${ep.id}/revisions`))}
                className="ml-auto rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40">{rev?.status === "planned" ? "Plan again" : "Edit video"}</button>
            </div>
            {open.length === 0 && <p className="mt-2 text-sm text-muted">No open notes.</p>}
            <ul className="mt-2 space-y-2">
              {open.map((n) => (
                <li key={n.id} className="flex items-start gap-2 text-sm">
                  <button onClick={() => n.cut_id === cut.id && seek(n.t_start, true)} className="shrink-0 tabular-nums text-accent hover:underline" title={`Written on v${n.cut_n}`}>
                    {n.final_shot ? "Final shot" : n.t_end != null ? `${fmt(n.t_start)}–${fmt(n.t_end)}` : fmt(n.t_start)}
                  </button>
                  {n.cut_id !== cut.id && <span className="shrink-0 rounded bg-stone-100 px-1 text-xs text-muted">v{n.cut_n}</span>}
                  <span className="min-w-0 flex-1">{n.text}</span>
                  {n.status === "planned" && <span className="shrink-0 text-xs text-muted">in the plan</span>}
                  <button onClick={() => act("del", () => call(`/api/edit-notes/${n.id}`, "DELETE"))} aria-label="Remove note" className="text-muted hover:text-red-700">×</button>
                </li>
              ))}
            </ul>
            {done.length > 0 && (
              <details className="mt-3 text-sm"><summary className="cursor-pointer text-muted">Done ({done.length})</summary>
                <ul className="mt-1 space-y-1 text-muted">{done.map((n) => <li key={n.id}>v{n.cut_n} {n.final_shot ? "final shot" : fmt(n.t_start)} · {n.text}</li>)}</ul>
              </details>
            )}
          </div>

          {rev && rev.status !== "discarded" && (
            <div className="studio-review-panel">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">Edit plan</p>
                {rev.user_edited && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-muted">edited by you</span>}
                {rev.status === "planned" && <span className="text-sm text-muted">{planCost ? `about ${usd(planCost)}` : "free"}</span>}
              </div>
              {rev.status === "planning" && <p className="mt-2 flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" />Reading your notes against v{d.cuts.find((c) => c.id === rev.base_cut_id)?.n}…</p>}
              {rev.status === "applying" && <p className="mt-2 flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" />{rev.progress ?? "Working…"}</p>}
              {rev.status === "failed" && (
                <div className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-800">
                  <p>{rev.error}</p>
                  {rev.plan.length > 0 && <button onClick={() => act("apply", () => call(`/api/revisions/${rev.id}/apply`))} className="mt-2 rounded-full bg-accent px-3 py-1 text-white">Try again</button>}
                </div>
              )}
              {rev.status === "applied" && rev.result_cut_id && (
                <p className="mt-2 text-sm">Applied. <button onClick={() => { setCutId(rev.result_cut_id); setCompare(true); }} className="text-accent hover:underline">
                  Watch v{d.cuts.find((c) => c.id === rev.result_cut_id)?.n} against the version before</button></p>
              )}
              {(rev.status === "planned" || rev.status === "applying" || rev.status === "applied" || rev.status === "failed") && (
                <ol className="mt-3 space-y-3">
                  {rev.plan.map((i, k) => (
                    <PlanItem key={k} i={i} note={d.notes.find((n) => n.id === i.note_id)} editable={rev.status === "planned"}
                      onChange={(next) => savePlan(rev.plan.map((x, j) => (j === k ? next : x)))}
                      onRemove={() => savePlan(rev.plan.filter((_, j) => j !== k))} />
                  ))}
                </ol>
              )}
              {rev.status === "planned" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button disabled={!!busy || !rev.plan.some((i) => i.kind !== "none")} onClick={() => act("apply", () => call(`/api/revisions/${rev.id}/apply`))}
                    className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40">Apply edits{planCost ? ` · about ${usd(planCost)}` : ""}</button>
                  <button disabled={!!busy} onClick={() => act("discard", () => call(`/api/revisions/${rev.id}`, "DELETE"))}
                    className="rounded-full border border-line px-4 py-1.5 text-sm hover:border-stone-400">Discard plan</button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Timeline({ cut, now, pins, onSeek }: { cut: Cut; now: number; pins: Note[]; onSeek: (t: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const pct = (t: number) => `${(100 * t) / cut.seconds}%`;
  return (
    <div>
      <div ref={ref} className="relative h-12 cursor-pointer select-none overflow-hidden rounded-lg bg-stone-100" role="slider" aria-label="Timeline"
        aria-valuemin={0} aria-valuemax={cut.seconds} aria-valuenow={now} tabIndex={0}
        onClick={(e) => { const r = ref.current!.getBoundingClientRect(); onSeek(((e.clientX - r.left) / r.width) * cut.seconds); }}
        onKeyDown={(e) => { if (e.key === "ArrowRight") onSeek(now + 1); if (e.key === "ArrowLeft") onSeek(now - 1); }}>
        {cut.clip_map.map((m) => (
          <div key={m.clip_id} title={`Scene ${m.scene} · clip ${m.n} · ${fmt(m.start)}`} className={`absolute inset-y-0 border-r border-white ${m.scene % 2 ? "bg-stone-300" : "bg-stone-200"}`}
            style={{ left: pct(m.start), width: pct(m.end - m.start) }}>
            <span className="absolute left-1 top-0.5 text-[10px] text-stone-600">{m.n}</span>
          </div>
        ))}
        {cut.changes.map((c, i) => <div key={i} className="absolute bottom-0 h-1.5 bg-emerald-500" style={{ left: pct(c.start), width: pct(c.end - c.start) }} title={c.label} />)}
        {pins.map((n) => (
          <div key={n.id} className="absolute top-0 h-full" style={{ left: pct(n.t_start), width: n.t_end != null ? pct(n.t_end - n.t_start) : "2px" }} title={n.text}>
            <div className="h-full w-full min-w-[2px] bg-amber-500/50" />
          </div>
        ))}
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-accent" style={{ left: pct(now) }} />
      </div>
      <div className="relative mt-1 h-4 text-[10px] text-muted">
        {cut.markers.map((m) => <span key={m.scene} className="absolute" style={{ left: pct(m.start) }}>Scene {m.scene}</span>)}
      </div>
    </div>
  );
}

function PlanItem({ i, note, editable, onChange, onRemove }: { i: Instr; note?: Note; editable: boolean; onChange: (i: Instr) => void; onRemove: () => void }) {
  const k = KIND[i.kind] ?? KIND.none;
  const num = (field: keyof Instr, label: string, step = 0.1) => (
    <label className="flex items-center gap-1">{label}
      <input type="number" step={step} defaultValue={Number(i[field])} disabled={!editable} key={`${field}-${i[field]}`}
        onBlur={(e) => Number(e.target.value) !== Number(i[field]) && onChange({ ...i, [field]: Number(e.target.value) })}
        className="w-20 rounded border border-line px-1 py-0.5" />
    </label>
  );
  const txt = (field: keyof Instr, label: string, cls = "") => (
    <label className="block"><span className="text-xs text-muted">{label}</span>
      <textarea defaultValue={String(i[field] ?? "")} disabled={!editable} key={`${field}-${i[field]}`} rows={1}
        onBlur={(e) => e.target.value !== i[field] && onChange({ ...i, [field]: e.target.value })}
        className={`w-full resize-none rounded border border-line px-2 py-1 outline-none [field-sizing:content] focus:border-accent ${cls}`} />
    </label>
  );
  return (
    <li className="rounded-xl border border-line p-3 text-sm">
      {note && <p className="text-xs text-muted">Note: {note.text}</p>}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${k.tone}`}>{k.label}</span>
        {i.affects?.length ? <span className="text-xs text-muted">clip{i.affects.length > 1 ? "s" : ""} {i.affects.join(", ")}</span> : null}
        <span className="text-xs text-muted">{i.est_cents ? `about $${(i.est_cents / 100).toFixed(2)}` : "free"}</span>
        {editable && <button onClick={onRemove} className="ml-auto text-xs text-muted hover:text-red-700">Remove</button>}
      </div>
      <p className="mt-1">{i.understood}</p>
      <div className="mt-2 space-y-2">
        {i.kind === "line_text" && (<>{txt("new_devanagari", `New words for ${i.line_id}`, "deva")}{txt("new_english", "English")}</>)}
        {i.kind === "sfx" && (<>{txt("sfx_description", "Sound")}<div className="flex flex-wrap gap-3">{num("at_s", "at (s)")}{num("duration_s", "long (s)")}{num("volume", "volume")}</div></>)}
        {i.kind === "trim" && <div className="flex flex-wrap gap-3">{num("trim_start_s", "cut from start (s)")}{num("trim_end_s", "cut from end (s)")}</div>}
        {i.kind === "ambience" && <div className="flex flex-wrap gap-3">{num("level", "level 0–1", 0.05)}</div>}
        {i.kind === "mute" && <div className="flex flex-wrap gap-3">{num("from_s", "from (s)")}{num("to_s", "to (s)")}</div>}
        {i.kind === "footage" && (<>{txt("prompt", "New prompt for the clip", "font-mono text-xs")}<div className="flex flex-wrap gap-3">{num("duration_s", "seconds (0 keeps)", 1)}</div></>)}
      </div>
    </li>
  );
}
