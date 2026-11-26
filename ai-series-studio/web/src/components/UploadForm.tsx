"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const ACCEPT = ".md,.markdown,.txt,.pdf";

export default function UploadForm() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [brief, setBrief] = useState("");
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    setFiles(next);
  };

  async function create() {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    fd.append("brief", brief);
    const r = await fetch("/api/projects", { method: "POST", body: fd });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error ?? "Something went wrong.");
      setBusy(false);
      return;
    }
    router.push(`/projects/${j.id}`);
  }

  return (
    <div className="space-y-5">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        className={`rounded-xl border border-dashed p-6 text-center transition ${drag ? "border-accent bg-accent-soft" : "border-line bg-white hover:border-stone-400"}`}
      >
        <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => add(e.target.files)} data-testid="file-input" />
        <button type="button" onClick={() => input.current?.click()} className="studio-upload-button">Upload files</button>
        <p className="mt-1 text-sm text-muted">Drop files here or upload Markdown, PDF, or plain text.</p>
      </div>

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((f) => (
            <li key={f.name} className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-3 pr-1 text-sm">
              {f.name}
              <span className="text-muted">{Math.max(1, Math.round(f.size / 1024))} KB</span>
              <button aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((x) => x !== f))} className="rounded-full px-2 text-muted hover:bg-stone-100">×</button>
            </li>
          ))}
        </ul>
      )}

      <label className="block">
        <span className="text-sm font-medium">Tell us about your series</span>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={4}
          placeholder="What is it about, who is it for, how long are the episodes, anything we must keep or change…"
          className="mt-2 w-full rounded-xl border border-line bg-white p-3 outline-none focus:border-accent"
        />
      </label>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <button
        onClick={create}
        disabled={busy || (!files.length && !brief.trim())}
        className="studio-primary"
      >
        {busy ? "Creating…" : "Create Microdrama"}
      </button>
    </div>
  );
}
