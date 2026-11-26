"use client";
import { useEffect } from "react";
import { KIND_LABEL, KIND_STYLE, type ProjectData, type SectionView } from "./types";

/** Light Markdown: drop the repeated heading line and show **bold** as bold. */
function SourceText({ text }: { text: string }) {
  const lines = text.split("\n");
  const body = /^#{1,6}\s/.test(lines[0] ?? "") ? lines.slice(1).join("\n").replace(/^\n+/, "") : text;
  return (
    <>
      {body.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
      )}
    </>
  );
}

export function SourceChips({ refs, sections, onOpen }: { refs: string[]; sections: Map<string, SectionView>; onOpen: (refs: string[]) => void }) {
  if (!refs?.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {refs.map((r) => {
        const s = sections.get(r);
        return (
          <button key={r} onClick={() => onOpen([r])} title={s ? [...s.path, s.heading].join(" › ") : r}
            className="rounded-md border border-line bg-white px-1.5 py-0.5 text-[11px] text-muted hover:border-accent hover:text-ink">
            {r}{s ? ` · ${s.heading.slice(0, 28)}${s.heading.length > 28 ? "…" : ""}` : ""}
          </button>
        );
      })}
    </span>
  );
}

export default function SourceDrawer({ refs, data, title, onClose }: { refs: string[]; data: ProjectData; title?: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const docs = new Map(data.documents.map((d) => [d.idx, d]));
  const secs = refs.map((r) => data.sections.find((s) => s.ref === r)).filter(Boolean) as SectionView[];
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onClick={onClose}>
      <aside role="dialog" aria-label="Source text" onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{title ?? "Source text"}</h2>
          <button onClick={onClose} className="rounded-full px-3 py-1 text-muted hover:bg-stone-100" aria-label="Close">×</button>
        </div>
        {secs.map((s) => (
          <section key={s.ref} className="mt-6 border-t border-line pt-4">
            <p className="text-xs text-muted">
              {docs.get(s.doc)?.filename} · lines {s.start_line}–{s.end_line} · {s.ref}
              {s.kind && <span className={`ml-2 rounded border px-1.5 py-0.5 ${KIND_STYLE[s.kind]}`}>{KIND_LABEL[s.kind]}</span>}
            </p>
            <p className="mt-1 font-medium deva">{[...s.path, s.heading].join(" › ")}</p>
            <pre className="deva mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed"><SourceText text={s.text} /></pre>
          </section>
        ))}
        {!secs.length && <p className="mt-6 text-muted">No source sections.</p>}
      </aside>
    </div>
  );
}
