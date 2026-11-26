"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Line = { id: string; speaker: string; devanagari: string; english: string; roman: string; direction: string };
type Scene = { n: number; heading: string; location_key: string; summary: string; duration_s: number; lines: Line[] };
type Settings = { model: string; resolution: string; aspect_ratio: string; fps: number; width: number; height: number; subtitles: boolean };
type Episode = {
  id: string; number: number; title: string; status: string; source: string; screenplay: { scenes: Scene[]; notes: string[] };
  settings: Settings; cut_sha: string | null; cut_srt_sha: string | null; cut_markers: { scene: number; title: string; start: number }[]; error: string | null;
};
type Shot = { t0: number; t1: number; framing: string; action: string };
type Clip = {
  id: string; scene_n: number; n: number; duration_s: number; shots: Shot[]; lines: { id: string; at: number }[]; refs: string[];
  prompt: string; sound: string; transition: string; status: string; current_take_id: string | null; error: string | null; changed_since_take: boolean;
};
type Take = {
  id: string; clip_id: string; n: number; provider: string; model: string; resolution: string; duration_s: number; prompt: string;
  status: string; video_sha: string | null; error: string | null; est_cents: number; cost_cents: number;
};
type Rec = { line_id: string; role_key: string; status: string; audio_sha: string | null; duration_s: number | null; error: string | null };
type Data = {
  episodes: { number: number; title: string; runtime: string; summary: string; script: string; note: string | null; started: boolean; suggested: boolean }[];
  number: number; roles: { key: string; name: string; locked: boolean; portrait_sha: string | null }[];
  items: { key: string; name: string; category: string; parent_key: string | null; thumb_sha: string | null }[];
  planJob: { status: string; error: string | null } | null; spentCents: number;
  provider: { name: string; models: Record<string, string> };
  episode: Episode | null; clips?: Clip[]; takes?: Take[]; recordings?: Rec[]; lineEstimates?: { id: string; est: number }[];
  estimate?: { remainingCents: number; runtimeS: number }; videoSpentCents?: number; linesJob?: { status: string; error: string | null } | null;
};

const shotText = (s: Shot) => (s.framing ? `${s.framing.replace(/\.$/, "")}. ${s.action}` : s.action);
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
const file = (sha: string) => `/api/files/${sha}`;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const DOT: Record<string, string> = {
  draft: "bg-stone-300", queued: "bg-amber-400 animate-pulse", generating: "bg-accent animate-pulse", ready: "bg-emerald-500", failed: "bg-red-500",
};

async function call(url: string, method = "POST", body?: unknown) {
  const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Something went wrong.");
  return j;
}

export default function EpisodeStudio({ projectId, onReview }: { projectId: string; onReview: () => void }) {
  const [d, setD] = useState<Data | null>(null);
  const [n, setN] = useState<number | null>(null);
  const [scene, setScene] = useState<number>(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [roman, setRoman] = useState(false);
  const player = useRef<HTMLVideoElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/projects/${projectId}/episode${n ? `?n=${n}` : ""}`, { cache: "no-store" });
    if (r.ok) setD(await r.json());
  }, [projectId, n]);
  useEffect(() => { load(); }, [load]);
  const ep = d?.episode ?? null;
  const active = !!ep && (["planning", "generating", "assembling"].includes(ep.status)
    || !!d?.clips?.some((c) => c.status === "queued" || c.status === "generating")
    || d?.linesJob?.status === "queued" || d?.linesJob?.status === "running");
  useEffect(() => {
    if (!active) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [active, load]);

  const act = async (label: string, fn: () => Promise<unknown>, after?: (r: unknown) => void) => {
    setBusy(label);
    setMsg(null);
    try { const r = await fn(); after?.(r); await load(); }
    catch (e) { setMsg({ kind: "error", text: (e as Error).message }); }
    finally { setBusy(null); }
  };

  const takesByClip = useMemo(() => {
    const m = new Map<string, Take[]>();
    for (const t of d?.takes ?? []) m.set(t.clip_id, [...(m.get(t.clip_id) ?? []), t]);
    return m;
  }, [d?.takes]);
  const recs = useMemo(() => new Map((d?.recordings ?? []).map((r) => [r.line_id, r])), [d?.recordings]);
  const ests = useMemo(() => new Map((d?.lineEstimates ?? []).map((r) => [r.id, r.est])), [d?.lineEstimates]);

  if (!d) return <p className="text-muted">Loading…</p>;
  const meta = d.episodes.find((e) => e.number === d.number);
  const picker = (
    <select value={d.number} onChange={(e) => { setN(Number(e.target.value)); setScene(1); }}
      className="rounded-full border border-line bg-white px-3 py-1.5 text-sm" aria-label="Episode">
      {d.episodes.map((e) => (
        <option key={e.number} value={e.number}>Episode {e.number}{e.suggested ? " (next to make)" : ""}{e.started ? " · started" : ""}</option>
      ))}
    </select>
  );

  // ---------- Not started, planning, failed ----------
  if (!ep || ep.status === "planning" || ep.status === "plan_failed") {
    return (
      <div className="space-y-4">
        <div className="studio-stage-bar">
          <h2 className="studio-stage-title">Create the episode</h2>
          {picker}
        </div>
        {msg && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{msg.text}</p>}
        <div className="rounded-2xl border border-line bg-white p-8">
          <p className="deva text-xl font-semibold">Episode {d.number}{meta?.title ? ` · ${meta.title}` : ""}</p>
          {meta && <p className="mt-2 max-w-3xl text-muted">{meta.summary}</p>}
          {meta?.note && <p className="mt-2 max-w-3xl text-sm text-muted">From your sources: {meta.note}</p>}
          {!ep && (
            <>
              <p className="mt-4 max-w-3xl text-sm">Claude writes the screenplay in Devanagari and English with matching line numbers, then splits every scene into clips with shots, framing, the approved references and the locked voices. Nothing is paid for video until you press Create.</p>
              <button disabled={!!busy} onClick={() => act("plan", () => call(`/api/projects/${projectId}/episode`, "POST", { number: d.number }))}
                className="studio-primary mt-5">Write the screenplay and shot plan</button>
            </>
          )}
          {ep?.status === "planning" && (
            <p className="mt-5 flex items-center gap-3 font-medium"><span className="h-3 w-3 animate-pulse rounded-full bg-accent" />Writing the screenplay and splitting it into clips… this takes a minute or two.</p>
          )}
          {ep?.status === "plan_failed" && (
            <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
              <p>The plan could not be written: {ep.error ?? d.planJob?.error}</p>
              <button onClick={() => act("plan", () => call(`/api/projects/${projectId}/episode`, "POST", { number: d.number }))}
                className="mt-3 rounded-full bg-accent px-4 py-1.5 font-semibold text-white">Try again</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------- The plan ----------
  const scenes = ep.screenplay.scenes;
  const clips = d.clips ?? [];
  const sel = scenes.find((s) => s.n === scene) ?? scenes[0];
  const sceneClips = clips.filter((c) => c.scene_n === sel?.n);
  const ready = clips.filter((c) => c.current_take_id).length;
  const working = clips.filter((c) => c.status === "queued" || c.status === "generating").length;
  const roleName = (k: string) => d.roles.find((r) => r.key === k)?.name ?? (k || "Unassigned");
  const item = (k: string) => d.items.find((i) => i.key === k);
  const linesTotal = scenes.reduce((a, s) => a + s.lines.length, 0);
  const recorded = scenes.reduce((a, s) => a + s.lines.filter((l) => recs.get(l.id)?.status === "ready").length, 0);
  const providerLabel = d.provider.name === "higgsfield" ? `Higgsfield · ${d.provider.models[ep.settings.model]}`
    : "Placeholder clips (test mode, free): add HIGGSFIELD_API_KEY for real video";
  const patchSettings = (s: Partial<Settings>) => act("settings", () => call(`/api/episodes/${ep.id}`, "PATCH", { settings: s }));

  return (
    <div className="space-y-4">
      <div className="studio-stage-bar">
        <h2 className="studio-stage-title deva">Episode {ep.number} · {ep.title}</h2>
        {picker}
        <p className="text-sm"><span className="font-semibold">{ready} of {clips.length}</span> clips ready{working ? ` · ${working} in progress` : ""}</p>
        <span className="text-line">|</span>
        <p className="text-sm text-muted">Runtime {mmss(d.estimate?.runtimeS ?? 0)}{meta?.runtime ? ` (target ${meta.runtime})` : ""}</p>
        <span className="text-line">|</span>
        <p className="text-sm text-muted">{ep.settings.aspect_ratio} · {ep.settings.width}×{ep.settings.height} · {ep.settings.fps} fps</p>
        <span className="text-line">|</span>
        <p className="text-sm text-muted">Spent {usd(d.spentCents)} on this project{d.videoSpentCents ? ` (${usd(d.videoSpentCents)} video)` : ""}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-3 text-sm">
        <span className={d.provider.name === "higgsfield" ? "text-muted" : "text-amber-800"}>{providerLabel}</span>
        <label className="flex items-center gap-1">Model
          <select value={ep.settings.model} onChange={(e) => patchSettings({ model: e.target.value })} className="rounded-md border border-line px-2 py-1">
            {Object.entries(d.provider.models).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1">Quality
          <select value={ep.settings.resolution} onChange={(e) => patchSettings({ resolution: e.target.value })} className="rounded-md border border-line px-2 py-1">
            <option value="480p">Draft 480p</option><option value="720p">720p</option><option value="1080p">Final 1080p</option>
          </select>
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={ep.settings.subtitles} onChange={(e) => patchSettings({ subtitles: e.target.checked })} /> Devanagari subtitles
        </label>
        <span className="text-line">|</span>
        <span className="text-muted">{recorded} of {linesTotal} lines recorded</span>
        <button disabled={!!busy || d.linesJob?.status === "running" || d.linesJob?.status === "queued"} onClick={() => act("record", () => call(`/api/episodes/${ep.id}/record`))}
          className="rounded-full border border-line px-3 py-1 hover:border-stone-400 disabled:opacity-40">
          {d.linesJob?.status === "running" || d.linesJob?.status === "queued" ? "Recording lines…" : recorded === linesTotal ? "Re-check recordings" : "Record all lines"}
        </button>
        <div className="ml-auto flex flex-wrap gap-2">
          <button disabled={!!busy || ready === clips.length || working > 0} onClick={() => act("all", () => call(`/api/episodes/${ep.id}/generate`, "POST", { all: true }),
            (r) => setMsg({ kind: "info", text: `Making ${clips.length - ready} clip(s), estimated ${usd((r as { estCents: number }).estCents)}. Cards update as each one finishes.` }))}
            className="rounded-full bg-accent px-4 py-2 font-semibold text-white disabled:opacity-40">
            Create Episode {ep.number}{d.estimate?.remainingCents ? ` · about ${usd(d.estimate.remainingCents)}` : ""}
          </button>
          <button disabled={!!busy || ready < clips.length || !clips.length || ep.status === "assembling"} onClick={() => act("assemble", () => call(`/api/episodes/${ep.id}/assemble`))}
            className="rounded-full border border-accent px-4 py-2 font-semibold text-accent disabled:opacity-40">
            {ep.status === "assembling" ? "Assembling…" : ep.cut_sha ? "Assemble again" : "Assemble the cut"}
          </button>
        </div>
      </div>
      {msg && <p className={`rounded-xl p-3 text-sm ${msg.kind === "error" ? "bg-red-50 text-red-800" : "bg-sky-50 text-sky-900"}`}>{msg.text}</p>}
      {ep.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{ep.error}</p>}
      {d.linesJob?.status === "failed" && d.linesJob.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">Recording: {d.linesJob.error}</p>}
      {ep.screenplay.notes.length > 0 && (
        <details className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <summary className="cursor-pointer font-medium">Check before generating ({ep.screenplay.notes.length}){ep.source === "draft" ? " · this screenplay is a draft" : ""}</summary>
          <ul className="mt-2 max-h-72 list-disc space-y-1 overflow-y-auto pl-5">{ep.screenplay.notes.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </details>
      )}

      {ep.cut_sha && (
        <section className="studio-review-panel" aria-label="Assembled cut">
          <div className="flex flex-wrap items-start gap-6">
            <video ref={player} controls preload="metadata" src={file(ep.cut_sha)} className="max-h-[70vh] rounded-xl bg-black" style={{ aspectRatio: `${ep.settings.width}/${ep.settings.height}` }} />
            <div className="min-w-56 flex-1">
              <p className="text-lg font-semibold">The assembled cut</p>
              <p className="text-sm text-muted">Our recorded dialogue over each clip&apos;s own sound{ep.settings.subtitles ? ", Devanagari subtitles burned in" : ""}. Watch it through: sound, motion and lip-sync need a human check.</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Scenes</p>
              <ul className="mt-1 space-y-1">
                {ep.cut_markers.map((m) => (
                  <li key={m.scene}><button onClick={() => { if (player.current) { player.current.currentTime = m.start; player.current.play(); } setScene(m.scene); }}
                    className="text-left text-sm hover:text-accent"><span className="tabular-nums text-muted">{mmss(m.start)}</span> · Scene {m.scene} · {m.title}</button></li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={`${file(ep.cut_sha)}?download=episode-${ep.number}.mp4`} className="rounded-full border border-line px-4 py-1.5 text-sm hover:border-stone-400">Download MP4</a>
                {ep.cut_srt_sha && <a href={`${file(ep.cut_srt_sha)}?download=episode-${ep.number}.srt`} className="rounded-full border border-line px-4 py-1.5 text-sm hover:border-stone-400">Download subtitles</a>}
                <button onClick={onReview} className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white">Review and edit</button>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* Left: the screenplay */}
        <section aria-label="Screenplay" className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Screenplay · {ep.source === "draft" ? "draft" : "from your sources"}</p>
            <label className="flex items-center gap-1 text-sm text-muted"><input type="checkbox" checked={roman} onChange={(e) => setRoman(e.target.checked)} /> Roman Hinglish</label>
          </div>
          {scenes.map((s) => {
            const sc = clips.filter((c) => c.scene_n === s.n);
            const done = sc.filter((c) => c.current_take_id).length;
            return (
              <div key={s.n} onClick={() => setScene(s.n)}
                className={`cursor-pointer rounded-2xl border bg-white p-4 ${s.n === sel?.n ? "border-accent ring-1 ring-accent" : "border-line hover:border-stone-400"}`}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="font-semibold">Scene {s.n}</p>
                  <p className="text-sm text-muted">{s.heading}</p>
                  <p className="ml-auto text-xs text-muted">{done}/{sc.length} clips · about {Math.round(s.duration_s)} s</p>
                </div>
                <p className="mt-1 text-sm">{s.summary}</p>
                {s.lines.length > 0 && (
                  <ol className="mt-3 space-y-2">
                    {s.lines.map((l) => {
                      const r = recs.get(l.id);
                      return (
                        <li key={l.id} className="rounded-lg bg-stone-50 p-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                            <span className="font-mono">{l.id}</span>
                            <select value={l.speaker} onChange={(e) => act("line", () => call(`/api/episodes/${ep.id}/lines/${l.id}`, "PATCH", { speaker: e.target.value }))}
                              className="rounded border border-line bg-white px-1 py-0.5 text-xs text-ink" aria-label={`Speaker of ${l.id}`}>
                              <option value="">No voice (background)</option>
                              {d.roles.map((ro) => <option key={ro.key} value={ro.key}>{ro.name}{ro.locked ? "" : " (no voice locked)"}</option>)}
                            </select>
                            {l.direction && <span className="italic">{l.direction}</span>}
                            <span className="ml-auto flex items-center gap-1">
                              {r?.status === "ready" && r.audio_sha ? <audio controls preload="none" src={file(r.audio_sha)} className="h-7 w-40" /> : null}
                              {r?.status === "ready" ? `${r.duration_s?.toFixed(1)} s` : r?.status === "recording" ? "recording…" : r?.status === "stale" ? <span className="text-amber-800">changed · records again with the clip</span> : r?.status === "failed" ? <span className="text-red-700" title={r.error ?? ""}>failed</span> : `~${ests.get(l.id) ?? "?"} s`}
                            </span>
                          </div>
                          <textarea key={`d-${l.id}-${l.devanagari}`} defaultValue={l.devanagari} rows={1}
                            onBlur={(e) => e.target.value.trim() !== l.devanagari && act("line", () => call(`/api/episodes/${ep.id}/lines/${l.id}`, "PATCH", { devanagari: e.target.value }))}
                            className="deva mt-1 w-full resize-none rounded-md border border-transparent bg-transparent px-1 text-base outline-none [field-sizing:content] focus:border-accent focus:bg-white" aria-label={`${l.id} in Devanagari`} />
                          <textarea key={`e-${l.id}-${l.english}`} defaultValue={l.english} rows={1}
                            onBlur={(e) => e.target.value.trim() !== l.english && act("line", () => call(`/api/episodes/${ep.id}/lines/${l.id}`, "PATCH", { english: e.target.value }))}
                            className="w-full resize-none rounded-md border border-transparent bg-transparent px-1 text-sm text-muted outline-none [field-sizing:content] focus:border-accent focus:bg-white" aria-label={`${l.id} in English`} />
                          {roman && <textarea key={`r-${l.id}-${l.roman}`} defaultValue={l.roman} rows={1}
                            onBlur={(e) => e.target.value.trim() !== l.roman && act("line", () => call(`/api/episodes/${ep.id}/lines/${l.id}`, "PATCH", { roman: e.target.value }))}
                            className="w-full resize-none rounded-md border border-transparent bg-transparent px-1 text-sm italic text-muted outline-none [field-sizing:content] focus:border-accent focus:bg-white" aria-label={`${l.id} in Roman Hinglish`} />}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            );
          })}
        </section>

        {/* Right: the production prompt for the selected scene */}
        {sel && (
          <section aria-label={`Scene ${sel.n} production`} className="space-y-3 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:self-start xl:overflow-y-auto">
            <div className="flex flex-wrap items-center gap-2 px-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Scene {sel.n} · {sceneClips.length} clip{sceneClips.length === 1 ? "" : "s"} · {sceneClips.reduce((a, c) => a + c.duration_s, 0)} s</p>
              <button disabled={!!busy || sceneClips.some((c) => c.status === "queued" || c.status === "generating")}
                onClick={() => act("scene", () => call(`/api/episodes/${ep.id}/generate`, "POST", { scene: sel.n }),
                  (r) => setMsg({ kind: "info", text: `Making scene ${sel.n}, estimated ${usd((r as { estCents: number }).estCents)}.` }))}
                className="ml-auto rounded-full border border-accent px-3 py-1 text-sm font-semibold text-accent disabled:opacity-40">
                {sceneClips.some((c) => c.current_take_id) ? "Generate this scene again" : "Test this scene first"}
              </button>
            </div>
            {sceneClips.map((c) => (
              <ClipCard key={c.id} clip={c} takes={takesByClip.get(c.id) ?? []} scene={sel} item={item} items={d.items} roleName={roleName}
                recs={recs} busy={!!busy} settings={ep.settings}
                onPatch={(p) => act("clip", () => call(`/api/episode-clips/${c.id}`, "PATCH", p))}
                onGenerate={() => act("gen", () => call(`/api/episodes/${ep.id}/generate`, "POST", { clipIds: [c.id] }))}
                onUse={(t) => act("use", () => call(`/api/episode-takes/${t}/use`))} />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

function ClipCard({ clip: c, takes, scene, item, items, roleName, recs, busy, settings, onPatch, onGenerate, onUse }: {
  clip: Clip; takes: Take[]; scene: Scene; item: (k: string) => Data["items"][number] | undefined; items: Data["items"];
  roleName: (k: string) => string; recs: Map<string, Rec>; busy: boolean; settings: Settings;
  onPatch: (p: Partial<Clip>) => void; onGenerate: () => void; onUse: (takeId: string) => void;
}) {
  const current = takes.find((t) => t.id === c.current_take_id) ?? null;
  const latest = takes[0] ?? null;
  const working = c.status === "queued" || c.status === "generating";
  const sceneLines = new Map(scene.lines.map((l) => [l.id, l]));
  const [showPrompt, setShowPrompt] = useState(false);
  return (
    <article className="studio-review-panel">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${DOT[c.status] ?? "bg-stone-300"}`} aria-hidden />
        <p className="font-semibold">Clip {c.n}</p>
        <label className="flex items-center gap-1 text-sm text-muted">
          <input key={`dur-${c.duration_s}`} type="number" min={4} max={settings.model === "seedance-2.5" ? 30 : 15} defaultValue={c.duration_s}
            onBlur={(e) => Number(e.target.value) !== c.duration_s && onPatch({ duration_s: Number(e.target.value) })}
            className="w-14 rounded border border-line px-1 py-0.5 text-ink" aria-label={`Clip ${c.n} seconds`} /> s
        </label>
        <span className="text-sm text-muted">{c.status === "queued" ? "queued" : c.status === "generating" ? "generating…" : c.status === "ready" ? "ready" : c.status === "failed" ? "failed" : "not made yet"}</span>
        <button disabled={busy || working} onClick={onGenerate}
          className="ml-auto rounded-full bg-accent px-3 py-1 text-sm font-semibold text-white disabled:opacity-40">
          {working ? "Working…" : current ? "Generate again" : latest?.status === "failed" ? "Try again" : "Generate"}
        </button>
      </div>
      {c.error && <p className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-800">{c.error}</p>}
      {current && c.changed_since_take && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">Changed since this take. Generate again to apply the change.</p>}

      <div className="mt-3 flex flex-wrap gap-4">
        {current?.video_sha ? (
          <video controls preload="metadata" src={file(current.video_sha)} className="h-72 rounded-lg bg-black" style={{ aspectRatio: `${settings.width}/${settings.height}` }} />
        ) : (
          <div className="flex h-72 items-center justify-center rounded-lg bg-stone-100 p-3 text-center text-xs text-muted" style={{ aspectRatio: `${settings.width}/${settings.height}` }}>
            {working ? "Generating… usually 1 to 5 minutes" : "The clip plays here once made"}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-3 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Shots</p>
            <ol className="mt-1 space-y-1">
              {c.shots.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-16 shrink-0 tabular-nums text-muted">{s.t0}–{s.t1} s</span>
                  <textarea key={`${i}-${s.framing}-${s.action}`} defaultValue={shotText(s)} rows={1}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v === shotText(s)) return;
                      onPatch({ shots: c.shots.map((x, j) => (j === i ? { ...x, framing: "", action: v } : x)) });
                    }}
                    className="w-full resize-none rounded border border-transparent px-1 outline-none [field-sizing:content] focus:border-accent" aria-label={`Clip ${c.n} shot ${i + 1}`} />
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Dialogue</p>
            {c.lines.length === 0 && <p className="text-muted">No one speaks.</p>}
            {(() => {
              const sorted = [...c.lines].sort((a, b) => a.at - b.at);
              const warn: string[] = [];
              sorted.forEach((l, i) => {
                const r = recs.get(l.id);
                const len = r?.status === "ready" && r.duration_s ? r.duration_s : null;
                if (!len) return;
                const next = sorted[i + 1];
                if (next && l.at + len > next.at) warn.push(`${l.id} runs ${(l.at + len - next.at).toFixed(1)} s into ${next.id}; ${next.id} will start at ${(l.at + len + 0.15).toFixed(1)} s instead.`);
                if (l.at + len + 0.3 > c.duration_s) warn.push(`${l.id} ends at ${(l.at + len).toFixed(1)} s; the clip will be lengthened to ${Math.ceil(l.at + len + 0.3)} s.`);
              });
              return warn.length ? <p className="mt-1 rounded bg-amber-50 p-1.5 text-xs text-amber-900">{warn.join(" ")}</p> : null;
            })()}
            <ul className="mt-1 space-y-1">
              {c.lines.map((l) => {
                const line = sceneLines.get(l.id);
                const r = recs.get(l.id);
                return (
                  <li key={l.id} className="flex items-start gap-2">
                    <label className="shrink-0 text-muted">at <input key={`at-${l.at}`} type="number" step={0.1} min={0} defaultValue={l.at}
                      onBlur={(e) => Number(e.target.value) !== l.at && onPatch({ lines: c.lines.map((x) => (x.id === l.id ? { ...x, at: Number(e.target.value) } : x)) })}
                      className="w-14 rounded border border-line px-1 py-0.5 text-ink" aria-label={`${l.id} start`} /> s</label>
                    <span><span className="font-medium">{roleName(line?.speaker ?? "")}</span>{" "}<span className="deva">{line?.devanagari ?? l.id}</span>
                      {r?.status === "ready" && <span className="text-muted"> · {r.duration_s?.toFixed(1)} s</span>}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Locked references</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {c.refs.map((k) => {
                const it = item(k);
                return (
                  <span key={k} className="flex items-center gap-1 rounded-full border border-line py-0.5 pl-0.5 pr-2 text-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {it?.thumb_sha ? <img src={file(it.thumb_sha)} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="h-7 w-7 rounded-full bg-stone-100" />}
                    {it?.name ?? k}
                    <button onClick={() => onPatch({ refs: c.refs.filter((x) => x !== k) })} aria-label={`Remove ${it?.name ?? k}`} className="text-muted hover:text-red-700">×</button>
                  </span>
                );
              })}
              <select value="" onChange={(e) => e.target.value && onPatch({ refs: [...c.refs, e.target.value] })} className="rounded-full border border-dashed border-line px-2 py-0.5 text-xs" aria-label="Add a reference">
                <option value="">+ add</option>
                {items.filter((i) => !c.refs.includes(i.key)).map((i) => <option key={i.key} value={i.key}>{i.name} ({i.category})</option>)}
              </select>
            </div>
          </div>
          <label className="block"><span className="text-xs font-semibold uppercase tracking-wide text-muted">Sound</span>
            <input key={`snd-${c.sound}`} defaultValue={c.sound} onBlur={(e) => e.target.value !== c.sound && onPatch({ sound: e.target.value })}
              className="mt-1 w-full rounded border border-line px-2 py-1" /></label>
          <label className="block"><span className="text-xs font-semibold uppercase tracking-wide text-muted">Into the next clip</span>
            <input key={`tr-${c.transition}`} defaultValue={c.transition} onBlur={(e) => e.target.value !== c.transition && onPatch({ transition: e.target.value })}
              className="mt-1 w-full rounded border border-line px-2 py-1" /></label>
        </div>
      </div>

      <details className="mt-3 text-sm" open={showPrompt} onToggle={(e) => setShowPrompt((e.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer text-muted">Prompt for the video model</summary>
        <textarea key={`p-${c.prompt}`} defaultValue={c.prompt} rows={6} onBlur={(e) => e.target.value !== c.prompt && onPatch({ prompt: e.target.value })}
          className="mt-2 w-full rounded-lg border border-line px-3 py-2 font-mono text-xs outline-none [field-sizing:content] focus:border-accent" aria-label={`Clip ${c.n} prompt`} />
        {latest?.prompt && <details className="mt-1"><summary className="cursor-pointer text-xs text-muted">As last sent, with references and dialogue</summary>
          <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-stone-50 p-2 text-xs">{latest.prompt}</pre></details>}
      </details>

      {takes.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted">Takes:</span>
          {takes.map((t) => (
            <span key={t.id} className={`rounded-full border px-2 py-0.5 ${t.id === c.current_take_id ? "border-emerald-400 bg-emerald-50" : "border-line"}`}>
              {t.n} · {t.resolution} · {t.status === "ready" ? (t.cost_cents ? usd(t.cost_cents) : "free") : t.status}
              {t.status === "ready" && t.id !== c.current_take_id && <button disabled={busy} onClick={() => onUse(t.id)} className="ml-1 text-accent hover:underline">use</button>}
              {t.status === "failed" && t.error && <span className="ml-1 text-red-700" title={t.error}>ⓘ</span>}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
