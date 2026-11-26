"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Role = {
  id: string; key: string; name: string; portrait_item_key: string | null; voice_brief: string; audition_text: string;
  script_lines: string[]; reference_hint: string | null; reference_audio_sha: string | null; required: boolean; protected: boolean;
  status: string; locked_candidate_id: string | null;
};
type Cand = {
  id: string; role_id: string; n: number; source: string; label: string; provider: string; provider_voice_id: string | null;
  description: string | null; model: string | null; text: string; audio_sha: string | null; status: string; error: string | null; cost_cents: number;
};
type Data = {
  status: string; roles: Role[]; candidates: Cand[]; portraits: { key: string; file_sha: string | null }[];
  pronunciations: { id: string; written: string; say_as: string; note: string | null; active: boolean }[];
  planJob: { status: string; error: string | null } | null; failures: { role_id: string; error: string }[];
  provider: { name: string; designModel: string; ttsModel: string }; spentCents: number;
};

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
const file = (sha: string) => `/api/files/${sha}`;
const DOT: Record<string, string> = { todo: "bg-stone-300", generating: "bg-accent animate-pulse", review: "bg-sky-500", locked: "bg-emerald-500" };

async function call(url: string, method = "POST", body?: unknown) {
  const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Something went wrong.");
  return j;
}

export default function VoiceCasting({ projectId, onFinished }: { projectId: string; onFinished: (toEpisode: boolean) => void }) {
  const [d, setD] = useState<Data | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [paste, setPaste] = useState("");
  const [newP, setNewP] = useState({ written: "", say_as: "", note: "" });
  const planned = useRef(false);
  const refInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/projects/${projectId}/voices`, { cache: "no-store" });
    if (r.ok) setD(await r.json());
  }, [projectId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (d?.status === "none" && !planned.current) {
      planned.current = true;
      call(`/api/projects/${projectId}/voices/plan`).then(load).catch((e) => setMsg({ kind: "error", text: e.message }));
    }
  }, [d?.status, projectId, load]);
  const active = !!d && (d.status === "planning" || d.roles.some((r) => r.status === "generating") || d.candidates.some((c) => c.status === "queued" || c.status === "generating"));
  useEffect(() => {
    if (!active) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [active, load]);
  useEffect(() => { if (!sel && d?.roles.length) setSel(d.roles[0].id); }, [d, sel]);

  const act = async (label: string, fn: () => Promise<unknown>, after?: (r: unknown) => void) => {
    setBusy(label);
    setMsg(null);
    try { const r = await fn(); after?.(r); await load(); }
    catch (e) { setMsg({ kind: "error", text: (e as Error).message }); }
    finally { setBusy(null); }
  };

  if (!d) return <p className="text-muted">Loading…</p>;
  if (d.status === "none" || d.status === "planning") {
    return (
      <div className="rounded-2xl border border-line bg-white p-8">
        <p className="flex items-center gap-3 text-lg font-medium"><span className="h-3 w-3 animate-pulse rounded-full bg-accent" /> Finding the speaking parts…</p>
        <p className="mt-2 text-muted">Reading the screenplay for every character who speaks, their lines, and the names a voice might say wrongly.</p>
      </div>
    );
  }
  if (d.status === "failed") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
        <p className="text-lg font-medium text-red-800">The speaking parts could not be planned.</p>
        <p className="mt-2 text-sm text-red-800">{d.planJob?.error}</p>
        <button onClick={() => act("plan", () => call(`/api/projects/${projectId}/voices/plan`))} className="mt-4 rounded-full bg-accent px-5 py-2 font-semibold text-white">Try again</button>
      </div>
    );
  }

  const required = d.roles.filter((r) => r.required);
  const locked = required.filter((r) => r.status === "locked").length;
  const role = d.roles.find((r) => r.id === sel) ?? null;
  const cands = role ? d.candidates.filter((c) => c.role_id === role.id) : [];
  const portrait = role?.portrait_item_key ? d.portraits.find((p) => p.key === role.portrait_item_key)?.file_sha : null;
  const lastFailure = role ? d.failures.find((f) => f.role_id === role.id) : undefined;
  const chars = role ? [...role.audition_text].length : 0;
  const providerLabel = d.provider.name === "elevenlabs" ? `ElevenLabs · design ${d.provider.designModel} · speech ${d.provider.ttsModel}`
    : d.provider.name === "mock" ? "Test tones (no real voices)" : "No voice service: add ELEVENLABS_API_KEY to the settings file";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-4">
        <p className="text-sm"><span className="font-semibold">{locked} of {required.length}</span> speaking voices locked</p>
        <span className="text-line">|</span>
        <p className="text-sm text-muted">Spent {usd(d.spentCents)} on this project</p>
        <span className="text-line">|</span>
        <p className={`text-sm ${d.provider.name === "none" ? "text-red-700" : "text-muted"}`}>{providerLabel}</p>
        <button disabled={locked < required.length || !!busy}
          onClick={() => act("finish", () => call(`/api/projects/${projectId}/voices/finish`), (r) => {
            const res = r as { visualsDone: boolean };
            if (res.visualsDone) onFinished(true);
            else setMsg({ kind: "info", text: "Voices saved to the series bible. Episode 1 opens once visual approvals are saved too." });
          })}
          className="ml-auto rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
          Save voices and continue
        </button>
      </div>
      {msg && <p className={`rounded-xl p-3 text-sm ${msg.kind === "error" ? "bg-red-50 text-red-800" : "bg-sky-50 text-sky-900"}`}>{msg.text}</p>}

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <nav aria-label="Speaking parts" className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-2xl border border-line bg-white p-3">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">Speaking parts · {locked}/{required.length}</p>
            <ul>
              {d.roles.map((r) => {
                const face = r.portrait_item_key ? d.portraits.find((p) => p.key === r.portrait_item_key)?.file_sha : null;
                return (
                  <li key={r.id}>
                    <button onClick={() => { setSel(r.id); setPaste(""); }}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${sel === r.id ? "bg-accent-soft" : "hover:bg-stone-50"} ${r.required ? "" : "text-muted"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {face ? <img src={file(face)} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-100 text-xs">{r.name[0]}</span>}
                      <span className="flex-1 truncate">{r.name}</span>
                      <span className={`h-2.5 w-2.5 rounded-full ${DOT[r.status] ?? "bg-stone-300"}`} aria-label={r.status} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-2xl border border-line bg-white p-3">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">Pronunciation notes</p>
            <p className="px-2 pb-2 text-xs text-muted">Ticked notes replace the written word before every line is spoken. Suggestions start unticked.</p>
            <ul className="space-y-1 px-2 text-sm">
              {d.pronunciations.map((p) => (
                <li key={p.id} className={`flex items-start gap-2 ${p.active ? "" : "text-muted"}`}>
                  <input type="checkbox" checked={p.active} aria-label={`Use the note for ${p.written}`} className="mt-1 accent-[var(--color-accent)]"
                    onChange={(e) => act("togp", () => call(`/api/projects/${projectId}/pronunciations`, "PATCH", { pid: p.id, active: e.target.checked }))} />
                  <span className="deva flex-1"><b>{p.written}</b> → {p.say_as}{p.note ? <span className="block text-xs text-muted">{p.note}</span> : null}</span>
                  <button aria-label={`Remove ${p.written}`} onClick={() => act("delp", () => call(`/api/projects/${projectId}/pronunciations?pid=${p.id}`, "DELETE"))} className="text-muted hover:text-red-700">×</button>
                </li>
              ))}
            </ul>
            <div className="mt-2 grid gap-1 px-2">
              <input value={newP.written} onChange={(e) => setNewP({ ...newP, written: e.target.value })} placeholder="Written, e.g. देवेंद्र" className="deva rounded-md border border-line px-2 py-1 text-sm" />
              <input value={newP.say_as} onChange={(e) => setNewP({ ...newP, say_as: e.target.value })} placeholder="Say as, e.g. Dev-endra" className="deva rounded-md border border-line px-2 py-1 text-sm" />
              <button disabled={!newP.written.trim() || !newP.say_as.trim() || !!busy}
                onClick={() => act("addp", () => call(`/api/projects/${projectId}/pronunciations`, "POST", newP), () => setNewP({ written: "", say_as: "", note: "" }))}
                className="rounded-full border border-line px-3 py-1 text-sm hover:border-stone-400 disabled:opacity-40">Add note</button>
            </div>
          </div>
        </nav>

        {role && (
          <section className="rounded-2xl border border-line bg-white p-5" aria-label={role.name}>
            <div className="flex flex-wrap items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {portrait ? <img src={file(portrait)} alt={`${role.name}, approved look`} className="h-28 w-24 rounded-xl object-cover" />
                : <div className="flex h-28 w-24 items-center justify-center rounded-xl bg-stone-100 p-2 text-center text-xs text-muted">Portrait appears once the look is approved</div>}
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold">{role.name}</h2>
                <p className="mt-1 text-sm text-muted">{role.required ? "Speaks in an episode to be produced" : "Optional: speaks only in an episode already made"}</p>
                {role.protected && <span className="mt-2 inline-block rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-900">Young speaker</span>}
                {role.status === "locked" && <span className="ml-2 mt-2 inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800">Voice locked</span>}
              </div>
            </div>

            <label className="mt-4 block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Voice brief</span>
              <textarea key={`b-${role.id}`} defaultValue={role.voice_brief} rows={2}
                onBlur={(e) => e.target.value !== role.voice_brief && act("brief", () => call(`/api/voices/roles/${role.id}`, "PATCH", { voice_brief: e.target.value }))}
                className="w-full resize-none rounded-lg border border-line px-3 py-2 text-sm outline-none [field-sizing:content] focus:border-accent" />
            </label>
            <label className="mt-3 block">
              <span className="mb-1 flex justify-between text-xs font-medium uppercase tracking-wide text-muted">
                <span>Audition text: every candidate reads this</span><span className={chars < 100 || chars > 1000 ? "text-red-700" : ""}>{chars} characters</span>
              </span>
              <textarea key={`a-${role.id}`} defaultValue={role.audition_text} rows={3}
                onBlur={(e) => e.target.value !== role.audition_text && act("text", () => call(`/api/voices/roles/${role.id}`, "PATCH", { audition_text: e.target.value }))}
                className="deva w-full resize-none rounded-lg border border-line px-3 py-2 outline-none [field-sizing:content] focus:border-accent" />
            </label>
            {role.script_lines.length > 0 && (
              <details className="mt-2 text-sm"><summary className="cursor-pointer text-muted">Lines in the script ({role.script_lines.length})</summary>
                <ul className="deva mt-2 list-disc pl-5">{role.script_lines.map((l, i) => <li key={i}>{l}</li>)}</ul></details>
            )}

            <div className="mt-4 rounded-xl border border-line p-3 text-sm">
              <p className="font-medium">Reference recording</p>
              <p className="mt-1 text-muted">{role.reference_hint ? `How they sounded before: ${role.reference_hint}. ` : ""}Upload a clip and new suggestions will be designed to sound like it.</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {role.reference_audio_sha && <audio controls src={file(role.reference_audio_sha)} className="h-9" />}
                <button onClick={() => refInput.current?.click()} className="rounded-full border border-line px-3 py-1 hover:border-stone-400">{role.reference_audio_sha ? "Replace" : "Upload a clip"}</button>
                {role.reference_audio_sha && <button onClick={() => act("unref", () => call(`/api/voices/roles/${role.id}/reference`, "DELETE"))} className="text-muted hover:text-red-700">Remove</button>}
              </div>
              <input ref={refInput} type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a" className="hidden" data-testid="voice-ref-upload"
                onChange={(e) => {
                  const f = e.target.files?.[0]; e.target.value = "";
                  if (!f) return;
                  const fd = new FormData(); fd.append("file", f);
                  act("ref", async () => { const r = await fetch(`/api/voices/roles/${role.id}/reference`, { method: "POST", body: fd }); const j = await r.json(); if (!r.ok) throw new Error(j.error); });
                }} />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button disabled={!!busy || d.provider.name === "none" || role.status === "generating"}
                onClick={() => act("suggest", () => call(`/api/voices/roles/${role.id}/suggest`))}
                className="rounded-full bg-accent px-5 py-2 font-semibold text-white disabled:opacity-40">
                {role.status === "generating" ? "Designing voices…" : cands.length ? "Suggest 3 more voices" : "Suggest 3 voices"}
              </button>
              <span className="text-sm text-muted">or</span>
              <input value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste an ElevenLabs Voice ID"
                className="w-64 rounded-full border border-line px-4 py-2 text-sm outline-none focus:border-accent" />
              <button disabled={!paste.trim() || !!busy || d.provider.name === "none"}
                onClick={() => act("paste", () => call(`/api/voices/roles/${role.id}/paste`, "POST", { voiceId: paste.trim() }), () => setPaste(""))}
                className="rounded-full border border-line px-4 py-2 text-sm hover:border-stone-400 disabled:opacity-40">{busy === "paste" ? "Checking…" : "Try this voice"}</button>
            </div>
            {lastFailure && role.status !== "generating" && <p className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-800">Last suggestion failed: {lastFailure.error}</p>}

            <ul className="mt-4 space-y-3">
              {cands.map((c) => {
                const isLocked = role.locked_candidate_id === c.id;
                return (
                  <li key={c.id} className={`rounded-xl border p-3 ${isLocked ? "border-emerald-300 bg-emerald-50/40" : "border-line"}`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-medium">{c.label}</p>
                      <span className="text-xs text-muted">{c.source === "pasted" ? "Your Voice ID" : "Designed"}{c.provider === "mock" ? " · test tone" : ""}{c.provider_voice_id ? ` · ${c.provider_voice_id}` : ""}</span>
                      {isLocked && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Locked</span>}
                    </div>
                    {c.status === "ready" && c.audio_sha && <audio controls preload="none" src={file(c.audio_sha)} className="mt-2 w-full" />}
                    {(c.status === "queued" || c.status === "generating") && <p className="mt-2 flex items-center gap-2 text-sm text-muted"><span className="h-2 w-2 animate-pulse rounded-full bg-accent" />Recording…</p>}
                    {c.status === "failed" && <p className="mt-2 text-sm text-red-700">{c.error}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {c.status === "ready" && !isLocked && (
                        <button disabled={!!busy} onClick={() => act("lock", () => call(`/api/voices/candidates/${c.id}/lock`), (r) => setMsg({ kind: "info", text: `Locked ${role.name} to voice ${(r as { voiceId: string }).voiceId}.` }))}
                          className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40">Lock this voice</button>
                      )}
                      {c.provider_voice_id && c.status !== "queued" && c.status !== "generating" && (
                        <button disabled={!!busy} onClick={() => act("replay", () => call(`/api/voices/candidates/${c.id}/replay`))}
                          className="rounded-full border border-line px-4 py-1.5 text-sm hover:border-stone-400 disabled:opacity-40">Hear it again with the notes</button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
