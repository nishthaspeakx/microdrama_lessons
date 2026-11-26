"use client";
import { useCallback, useEffect, useState } from "react";
import Stepper from "./Stepper";
import IntakeReview from "./IntakeReview";
import VisualReview from "./VisualReview";
import type { ProjectData } from "./types";

const NEXT_PHASE: Record<number, { title: string; body: string }> = {
  3: { title: "Lock voices", body: "ElevenLabs auditions on the same script line for every speaking character, voice locks and pronunciation notes. This is build phase 2." },
  4: { title: "Episode 1", body: "Screenplay and production prompt side by side, then scene-by-scene generation and assembly. This is build phase 3." },
  5: { title: "Review & export", body: "Timestamped edit notes, the smallest edit that meets each one, versions, MP4 and subtitles. This is build phase 4." },
};

export default function ProjectView({ id }: { id: string }) {
  const [data, setData] = useState<ProjectData | null>(null);
  const [view, setView] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/projects/${id}`, { cache: "no-store" });
    if (!r.ok) { setErr("This project was not found."); return; }
    setData(await r.json());
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (data?.project.status !== "extracting") return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [data?.project.status, load]);

  if (err) return <p className="p-10 text-muted">{err}</p>;
  if (!data) return <p className="p-10 text-muted">Loading…</p>;
  const step = view ?? data.project.step;

  const goStep = async (n: number) => {
    const r = await fetch(`/api/projects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step: n }) });
    if (!r.ok) return (await r.json()).error ?? "Could not continue.";
    setView(n);
    await load();
    return null;
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="deva text-2xl font-semibold">{data.intake?.summary.series.title ?? data.project.name}</h1>
        <Stepper current={step} reached={data.project.step} onGo={(n) => setView(n)} />
      </div>

      {step === 1 && data.project.status === "extracting" && (
        <div className="rounded-2xl border border-line bg-white p-8">
          <p className="flex items-center gap-3 text-lg font-medium"><span className="h-3 w-3 animate-pulse rounded-full bg-accent" /> Reading your sources…</p>
          <p className="mt-2 text-muted">Finding the episodes, characters, places and production notes, and checking where the documents disagree.</p>
          <ul className="mt-6 space-y-1 text-sm">
            {data.documents.map((d) => (
              <li key={d.id}>d{d.idx} · {d.filename} · {data.sections.filter((s) => s.doc === d.idx).length} sections</li>
            ))}
          </ul>
        </div>
      )}

      {step === 1 && data.project.status === "intake_failed" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
          <p className="text-lg font-medium text-red-800">We could not read the sources.</p>
          <p className="mt-2 text-sm text-red-800">{data.job?.error}</p>
          <button onClick={async () => { await fetch(`/api/projects/${id}/retry`, { method: "POST" }); load(); }}
            className="mt-4 rounded-full bg-accent px-5 py-2 font-semibold text-white">Try again</button>
        </div>
      )}

      {step === 1 && data.project.status === "intake_ready" && data.intake && <IntakeReview data={data} onContinue={() => goStep(2)} />}

      {step === 2 && <VisualReview projectId={id} onFinished={() => { setView(3); load(); }} />}

      {step > 2 && NEXT_PHASE[step] && (
        <div className="rounded-2xl border border-line bg-white p-8">
          <p className="text-lg font-semibold">{NEXT_PHASE[step].title}</p>
          <p className="mt-2 max-w-2xl text-muted">{NEXT_PHASE[step].body}</p>
          <p className="mt-4 text-sm text-muted">Your summary is saved. You can go back to it at any time.</p>
          <button onClick={() => setView(1)} className="mt-4 rounded-full border border-line px-5 py-2 hover:border-stone-400">Back to the summary</button>
        </div>
      )}
    </main>
  );
}
