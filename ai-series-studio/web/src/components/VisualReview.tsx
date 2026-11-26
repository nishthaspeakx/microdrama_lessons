"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Item = {
  id: string; category: "character" | "wardrobe" | "location" | "prop"; key: string; name: string; description: string;
  base_prompt: string; parent_key: string | null; episodes: number[]; required: boolean; protected: boolean;
  reference_hint: string | null; status: string; approved_version_id: string | null; flag_reason: string | null;
};
type Version = {
  id: string; item_id: string; n: number; prompt: string; change_request: string | null; understood: string | null;
  views: string[]; status: string; error: string | null; provider: string | null; est_cents: number; cost_cents: number;
  base_version_id: string | null; reference_shas: string[];
};
type Img = { version_id: string; view: string; file_sha: string };
type Data = {
  status: string; style: string | null; items: Item[]; versions: Version[]; images: Img[];
  planJob: { status: string; error: string | null } | null;
  views: Record<string, { view: string; label: string; aspect: string }[]>;
  provider: { name: string; label: string; model: string; centsPerImage: number };
  spentCents: number; budgetCents: number;
};

const GROUPS: { cat: Item["category"]; label: string }[] = [
  { cat: "character", label: "Characters" }, { cat: "wardrobe", label: "Wardrobe & accessories" },
  { cat: "location", label: "Locations" }, { cat: "prop", label: "Props & vehicles" },
];
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
const img = (sha: string) => `/api/files/${sha}`;
const DOT: Record<string, string> = {
  todo: "bg-stone-300", generating: "bg-accent animate-pulse", review: "bg-sky-500", approved: "bg-emerald-500", flagged: "bg-red-500",
};
const ASPECT: Record<string, string> = { "3:4": "aspect-[3/4]", "16:9": "aspect-video", "9:16": "aspect-[9/16]", "1:1": "aspect-square" };

async function post(url: string, body?: unknown) {
  const r = await fetch(url, { method: "POST", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Something went wrong.");
  return j;
}

export default function VisualReview({ projectId, onFinished }: { projectId: string; onFinished: () => void }) {
  const [d, setD] = useState<Data | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [verSel, setVerSel] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [changeText, setChangeText] = useState("");
  const [showChange, setShowChange] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const planned = useRef(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/projects/${projectId}/visuals`, { cache: "no-store" });
    if (r.ok) setD(await r.json());
  }, [projectId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (d?.status === "none" && !planned.current) {
      planned.current = true;
      post(`/api/projects/${projectId}/visuals/plan`).then(load).catch((e) => setMsg({ kind: "error", text: e.message }));
    }
  }, [d?.status, projectId, load]);
  const active = !!d && (d.status === "planning" || d.versions.some((v) => v.status === "queued" || v.status === "generating"));
  useEffect(() => {
    if (!active) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [active, load]);

  const items = useMemo(() => d?.items ?? [], [d]);
  useEffect(() => { if (!sel && items.length) setSel(items[0].id); }, [items, sel]);

  const act = async (label: string, fn: () => Promise<unknown>, after?: (r: unknown) => void) => {
    setBusy(label);
    setMsg(null);
    try {
      const r = await fn();
      after?.(r);
      await load();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  if (!d) return <p className="text-muted">Loading…</p>;
  if (d.status === "none" || d.status === "planning") {
    return (
      <div className="rounded-2xl border border-line bg-white p-8">
        <p className="flex items-center gap-3 text-lg font-medium"><span className="h-3 w-3 animate-pulse rounded-full bg-accent" /> Planning what to approve…</p>
        <p className="mt-2 text-muted">Turning your summary into the list of characters, outfits, places and props, each with a description and an image prompt.</p>
      </div>
    );
  }
  if (d.status === "failed") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
        <p className="text-lg font-medium text-red-800">The visual list could not be planned.</p>
        <p className="mt-2 text-sm text-red-800">{d.planJob?.error}</p>
        <button onClick={() => act("plan", () => post(`/api/projects/${projectId}/visuals/plan`))} className="mt-4 rounded-full bg-accent px-5 py-2 font-semibold text-white">Try again</button>
      </div>
    );
  }

  const versionsOf = (id: string) => d.versions.filter((v) => v.item_id === id).sort((a, b) => b.n - a.n);
  const imagesOf = (vid: string) => d.images.filter((i) => i.version_id === vid);
  const required = items.filter((i) => i.required);
  const approvedCount = required.filter((i) => i.status === "approved").length;
  const todoRequired = required.filter((i) => i.status === "todo" && !versionsOf(i.id).some((v) => ["queued", "generating", "ready"].includes(v.status)));
  const readyToGen = todoRequired.filter((i) => !i.parent_key || items.find((p) => p.key === i.parent_key)?.status === "approved");
  const estAll = readyToGen.reduce((s, i) => s + d.views[i.category].length * d.provider.centsPerImage, 0);
  const item = items.find((i) => i.id === sel) ?? null;
  const vers = item ? versionsOf(item.id) : [];
  const shown = item ? vers.find((v) => v.id === verSel[item.id]) ?? vers.find((v) => v.status === "draft") ?? vers.find((v) => v.id === item.approved_version_id) ?? vers[0] : undefined;
  const parent = item?.parent_key ? items.find((p) => p.key === item.parent_key) : undefined;
  const providerLabel = d.provider.name === "none" ? "No image model: add OPENAI_API_KEY to the settings file" : d.provider.name === "mock" ? d.provider.label : `${d.provider.label} ${d.provider.model}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-4">
        <p className="text-sm"><span className="font-semibold">{approvedCount} of {required.length}</span> required items approved</p>
        <span className="text-line">|</span>
        <p className="text-sm text-muted">Spent {usd(d.spentCents)} of {usd(d.budgetCents)} budget</p>
        <span className="text-line">|</span>
        <p className={`text-sm ${d.provider.name === "none" ? "text-red-700" : "text-muted"}`}>{providerLabel}</p>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            disabled={!readyToGen.length || !!busy || d.provider.name === "none"}
            onClick={() => act("all", () => post(`/api/projects/${projectId}/visuals/generate-all`), (r) => {
              const res = r as { queued: number; waiting: string[] };
              setMsg({ kind: "info", text: `Generating ${res.queued} item(s).${res.waiting.length ? ` ${res.waiting.length} wait for their parent look to be approved first.` : ""}` });
            })}
            className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:border-stone-400 disabled:opacity-40">
            Generate {readyToGen.length} to-do item{readyToGen.length === 1 ? "" : "s"}{estAll ? ` · about ${usd(estAll)}` : ""}
          </button>
          <button
            disabled={approvedCount < required.length || !!busy}
            onClick={() => act("finish", () => post(`/api/projects/${projectId}/visuals/finish`), () => onFinished())}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            Save to series bible and continue
          </button>
        </div>
      </div>
      {msg && <p className={`rounded-xl p-3 text-sm ${msg.kind === "error" ? "bg-red-50 text-red-800" : "bg-sky-50 text-sky-900"}`}>{msg.text}</p>}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <nav aria-label="Items to approve" className="space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto">
          {GROUPS.map((g) => {
            const list = items.filter((i) => i.category === g.cat);
            if (!list.length) return null;
            return (
              <div key={g.cat} className="rounded-2xl border border-line bg-white p-3">
                <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  {g.label} · {list.filter((i) => i.status === "approved").length}/{list.length}
                </p>
                <ul>
                  {list.map((i) => (
                    <li key={i.id}>
                      <button onClick={() => { setSel(i.id); setShowChange(false); setChangeText(""); }}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${sel === i.id ? "bg-accent-soft" : "hover:bg-stone-50"} ${i.required ? "" : "text-muted"}`}>
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[i.status] ?? "bg-stone-300"}`} aria-hidden />
                        <span className="flex-1 truncate">{i.name}</span>
                        {!i.required && <span className="text-[10px] uppercase">optional</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        {item && (
          <section className="rounded-2xl border border-line bg-white p-5" aria-label={item.name}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{GROUPS.find((g) => g.cat === item.category)?.label}</p>
                <h2 className="text-xl font-semibold">{item.name}</h2>
                <p className="mt-1 text-sm text-muted">
                  {item.episodes.length ? `Episode ${item.episodes.join(", ")}` : ""}
                  {parent ? ` · based on ${parent.name}${parent.status === "approved" ? "" : " (not approved yet)"}` : ""}
                  {item.required ? "" : " · only in an episode already made"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {item.protected && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-900">Child: always fully clothed and age-appropriate</span>}
                {item.status === "approved" && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800">Approved · version {vers.find((v) => v.id === item.approved_version_id)?.n}</span>}
              </div>
            </div>

            {item.status === "flagged" && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{item.flag_reason}</p>}

            <label className="mt-4 block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Description</span>
              <textarea key={item.id} defaultValue={item.description} rows={2}
                onBlur={(e) => e.target.value !== item.description && act("desc", () => fetch(`/api/visuals/items/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: e.target.value }) }))}
                className="w-full resize-none rounded-lg border border-line px-3 py-2 text-sm outline-none [field-sizing:content] focus:border-accent" />
            </label>
            {item.reference_hint && <p className="mt-1 text-xs text-muted">Existing reference: {item.reference_hint}. Use “Use my image” to add it.</p>}

            {vers.length > 1 && (
              <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Versions">
                {vers.map((v) => (
                  <button key={v.id} role="tab" aria-selected={shown?.id === v.id} onClick={() => setVerSel({ ...verSel, [item.id]: v.id })}
                    className={`rounded-full border px-3 py-1 text-xs ${shown?.id === v.id ? "border-accent bg-accent-soft" : "border-line"}`}>
                    v{v.n}{v.id === item.approved_version_id ? " ✓" : ""}{v.provider === "upload" ? " · yours" : ""}{v.status === "draft" ? " · draft" : v.status === "failed" ? " · failed" : ["queued", "generating"].includes(v.status) ? " · making" : ""}
                  </button>
                ))}
              </div>
            )}

            {!shown && (
              <div className="mt-5 rounded-xl border border-dashed border-line p-6">
                <p className="font-medium">Nothing to review yet</p>
                <p className="mt-1 text-sm text-muted">
                  The app will make {d.views[item.category].map((v) => v.label.toLowerCase()).join(", ")}
                  {parent ? `, using ${parent.name}'s approved look as the reference` : ""}.
                </p>
                <details className="mt-3 text-sm"><summary className="cursor-pointer text-muted">Image prompt</summary><p className="mt-2 whitespace-pre-wrap">{item.base_prompt}</p></details>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button disabled={!!busy || d.provider.name === "none" || (!!parent && parent.status !== "approved")}
                    onClick={() => act("gen", () => post(`/api/visuals/items/${item.id}/generate`))}
                    className="rounded-full bg-accent px-5 py-2 font-semibold text-white disabled:opacity-40">
                    Generate · {d.views[item.category].length} images{d.provider.centsPerImage ? ` · about ${usd(d.views[item.category].length * d.provider.centsPerImage)}` : ""}
                  </button>
                  <button onClick={() => fileInput.current?.click()} className="rounded-full border border-line px-5 py-2 hover:border-stone-400">Use my image</button>
                </div>
                {parent && parent.status !== "approved" && <p className="mt-2 text-xs text-muted">Approve {parent.name} first, so this matches it.</p>}
              </div>
            )}

            {shown && (shown.status === "queued" || shown.status === "generating") && (
              <div className="mt-5">
                <p className="flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" />Making version {shown.n}…</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {shown.views.map((v) => <div key={v} className="aspect-[3/4] animate-pulse rounded-xl bg-stone-100" />)}
                </div>
              </div>
            )}

            {shown && shown.status === "failed" && (
              <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                <p className="font-medium">Version {shown.n} failed.</p>
                <p className="mt-1">{shown.error}</p>
                <button disabled={!!busy} onClick={() => act("retry", () => post(`/api/visuals/versions/${shown.id}/generate`))}
                  className="mt-3 rounded-full bg-accent px-4 py-2 font-semibold text-white disabled:opacity-40">Try again</button>
              </div>
            )}

            {shown && shown.status === "draft" && (
              <div className="mt-5 rounded-xl border border-accent/40 bg-accent-soft/50 p-4">
                <p className="text-sm font-semibold">Here is what I understood</p>
                {shown.change_request && <p className="mt-1 text-sm text-muted">You asked: “{shown.change_request}”</p>}
                <p className="mt-2">{shown.understood ?? "Generate from the planned prompt."}</p>
                <label className="mt-3 block">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Image prompt (you can edit it)</span>
                  <textarea key={shown.id} defaultValue={shown.prompt} rows={4}
                    onBlur={(e) => e.target.value !== shown.prompt && act("edit", () => fetch(`/api/visuals/versions/${shown.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: e.target.value }) }))}
                    className="w-full resize-none rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none [field-sizing:content] focus:border-accent" />
                </label>
                <p className="mt-2 text-sm text-muted">
                  Regenerates: {shown.views.map((v) => d.views[item.category].find((x) => x.view === v)?.label ?? v).join(", ")}
                  {shown.base_version_id && shown.views.length < d.views[item.category].length ? ` · other views stay as in version ${d.versions.find((v) => v.id === shown.base_version_id)?.n}` : ""}
                  {d.provider.centsPerImage ? ` · about ${usd(shown.est_cents)}${d.provider.name === "openai" ? " (estimate; actual cost is recorded)" : ""}` : ""}
                </p>
                <div className="mt-3 flex gap-2">
                  <button disabled={!!busy || d.provider.name === "none"} onClick={() => act("gen", () => post(`/api/visuals/versions/${shown.id}/generate`))}
                    className="rounded-full bg-accent px-5 py-2 font-semibold text-white disabled:opacity-40">Generate</button>
                  <button disabled={!!busy} onClick={() => act("discard", () => fetch(`/api/visuals/versions/${shown.id}`, { method: "DELETE" }), () => setVerSel({ ...verSel, [item.id]: "" }))}
                    className="rounded-full border border-line px-5 py-2 hover:border-stone-400">Discard</button>
                </div>
              </div>
            )}

            {shown && shown.status === "ready" && (
              <>
                <div className={`mt-5 grid gap-3 ${imagesOf(shown.id).length > 1 ? "sm:grid-cols-2" : ""}`}>
                  {(shown.provider === "upload" ? [{ view: "reference", label: "Your image", aspect: "3:4" }] : d.views[item.category]).map((v) => {
                    const im = imagesOf(shown.id).find((x) => x.view === v.view);
                    if (!im) return null;
                    return (
                      <figure key={v.view} className={v.aspect === "16:9" ? "sm:col-span-2" : ""}>
                        <a href={img(im.file_sha)} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img(im.file_sha)} alt={`${item.name}: ${v.label}`}
                            className={`mx-auto max-h-[55vh] w-full rounded-xl bg-stone-100 object-contain ${shown.provider === "upload" ? "" : ASPECT[v.aspect] ?? ""}`} />
                        </a>
                        <figcaption className="mt-1 text-xs text-muted">{v.label}{shown.views.includes(v.view) || shown.provider === "upload" ? "" : " · kept from the previous version"}</figcaption>
                      </figure>
                    );
                  })}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {shown.id !== item.approved_version_id ? (
                    <button disabled={!!busy} onClick={() => act("approve", () => post(`/api/visuals/versions/${shown.id}/approve`), (r) => {
                      const f = (r as { flagged: string[] }).flagged;
                      if (f.length) setMsg({ kind: "info", text: `Approved. Flagged for a second look because they depend on it: ${f.join(", ")}.` });
                    })} className="rounded-full bg-emerald-600 px-5 py-2 font-semibold text-white disabled:opacity-40">Approve version {shown.n}</button>
                  ) : (
                    <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm text-emerald-800">This version is approved</span>
                  )}
                  <button onClick={() => setShowChange(!showChange)} className="rounded-full border border-line px-5 py-2 hover:border-stone-400">Change</button>
                  <button onClick={() => fileInput.current?.click()} className="rounded-full border border-line px-5 py-2 hover:border-stone-400">Use my image</button>
                  <span className="text-xs text-muted">{shown.provider === "mock" ? "Placeholder image" : shown.provider === "upload" ? "Uploaded" : `Cost ${usd(shown.cost_cents)}`}</span>
                </div>
                {showChange && (
                  <div className="mt-3 rounded-xl border border-line p-3">
                    <label className="block text-sm font-medium" htmlFor="change">What should change?</label>
                    <textarea id="change" value={changeText} onChange={(e) => setChangeText(e.target.value)} rows={2}
                      placeholder="For example: make the dupatta maroon and keep the same face"
                      className="mt-2 w-full resize-none rounded-lg border border-line px-3 py-2 text-sm outline-none [field-sizing:content] focus:border-accent" />
                    <button disabled={!changeText.trim() || !!busy}
                      onClick={() => act("change", () => post(`/api/visuals/items/${item.id}/change`, { request: changeText, baseVersionId: shown.id }), (r) => {
                        setVerSel({ ...verSel, [item.id]: (r as { versionId: string }).versionId });
                        setShowChange(false);
                        setChangeText("");
                      })}
                      className="mt-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                      {busy === "change" ? "Working out the change…" : "Show me the new prompt"}
                    </button>
                  </div>
                )}
                <details className="mt-4 text-sm">
                  <summary className="cursor-pointer text-muted">Prompt and references for version {shown.n}</summary>
                  <p className="mt-2 whitespace-pre-wrap">{shown.prompt}</p>
                  {shown.reference_shas.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {shown.reference_shas.map((s) => <img key={s} src={img(s)} alt="Reference image used" className="h-20 rounded-md border border-line object-cover" />)}
                    </div>
                  )}
                </details>
              </>
            )}

            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" data-testid="visual-upload"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                const fd = new FormData();
                fd.append("file", f);
                act("upload", async () => {
                  const r = await fetch(`/api/visuals/items/${item.id}/upload`, { method: "POST", body: fd });
                  const j = await r.json();
                  if (!r.ok) throw new Error(j.error);
                  return j;
                }, (r) => setVerSel({ ...verSel, [item.id]: (r as { versionId: string }).versionId }));
              }} />
          </section>
        )}
      </div>
    </div>
  );
}
