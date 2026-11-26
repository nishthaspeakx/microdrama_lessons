import type { Intake } from "@/lib/intakeSchema";
export type { Intake };
export type SectionView = {
  ref: string; doc: number; level: number; heading: string; path: string[];
  start_line: number; end_line: number; kind: string | null; text: string;
};
export type ProjectData = {
  project: { id: string; name: string; step: number; status: string };
  documents: { id: string; idx: number; filename: string; kind: string; bytes: number }[];
  sections: SectionView[];
  intake: { summary: Intake; warnings: string[]; backend: string; model: string | null; updated_at: string } | null;
  job: { status: string; error: string | null; attempts: number } | null;
};
export const KIND_LABEL: Record<string, string> = {
  series_overview: "Series overview", screenplay: "Screenplay", production_note: "Production note",
  sample_prompt: "Sample prompt", coverage_table: "Shot coverage", reference_guidance: "Reference guidance",
  post_production: "Post-production", other: "Other",
};
export const KIND_STYLE: Record<string, string> = {
  screenplay: "bg-emerald-50 text-emerald-800 border-emerald-200",
  sample_prompt: "bg-violet-50 text-violet-800 border-violet-200",
  coverage_table: "bg-sky-50 text-sky-800 border-sky-200",
  production_note: "bg-amber-50 text-amber-800 border-amber-200",
  reference_guidance: "bg-rose-50 text-rose-800 border-rose-200",
  post_production: "bg-stone-100 text-stone-700 border-stone-200",
  series_overview: "bg-orange-50 text-orange-800 border-orange-200",
  other: "bg-stone-50 text-stone-600 border-stone-200",
};
