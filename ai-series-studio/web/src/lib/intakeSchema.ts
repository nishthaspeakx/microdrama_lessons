/**
 * The structured result of reading a project's sources (build phase 1).
 * Every fact carries `sources`: section references like "d1:s12".
 */
const str = { type: "string" } as const;
const nstr = { type: ["string", "null"] } as const;
const refs = { type: "array", items: { type: "string" } } as const;
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});

export const SECTION_KINDS = [
  "series_overview", "screenplay", "production_note", "sample_prompt", "coverage_table",
  "reference_guidance", "post_production", "other",
] as const;

/*
 * Kept to plain types on purpose: the API refused a stricter version (nullable
 * unions and enums everywhere) as "compiled grammar is too large". Empty strings
 * and 0 mean "not stated"; normalizeIntake() turns them into null and checks the
 * allowed values afterwards.
 */
const int = { type: "integer" } as const;
const strs = { type: "array", items: str } as const;
export const intakeSchema = obj({
  series: obj({
    title: str, title_alt: str, logline: str, episode_count: int, setting: str, era: str,
    language: str, dialogue_script: str, tone: str, aspect_ratio: str, fps: int, episode_length: str, sources: strs,
  }),
  episodes: { type: "array", items: obj({
    number: int, title: str, title_en: str, runtime: str, summary: str, ends_on: str,
    script_status: str, script_sections: strs, script_note: str, sources: strs,
  }) },
  characters: { type: "array", items: obj({
    key: str, name: str, aliases: strs,
    ages: { type: "array", items: obj({ period: str, age: str, sources: strs }) },
    role: str, description: str, appearance: str, speaks: { type: "boolean" }, first_episode: int,
    relationships: { type: "array", items: obj({ with: str, relation: str }) }, sources: strs,
  }) },
  locations: { type: "array", items: obj({ key: str, name: str, description: str, episodes: { type: "array", items: int }, sources: strs }) },
  props: { type: "array", items: obj({ key: str, name: str, description: str, sources: strs }) },
  production_requirements: { type: "array", items: obj({ category: str, text: str, sources: strs }) },
  conflicts: { type: "array", items: obj({
    id: str, topic: str, severity: str, description: str,
    options: { type: "array", items: obj({ value: str, sources: strs }) }, recommendation: str,
  }) },
  section_kinds: { type: "array", items: obj({ ref: str, kind: str }) },
  typed_brief_use: str,
});

const full = intakeSchema as unknown as { properties: Record<string, unknown> };
const part = (...keys: string[]) => ({
  type: "object", additionalProperties: false, required: keys,
  properties: Object.fromEntries(keys.map((k) => [k, full.properties[k]])),
});

/**
 * The full schema is too large for the API to enforce in one call, so the
 * extraction runs as three calls over the same cached input.
 */
export const INTAKE_PARTS = [
  { name: "story", keys: ["series", "episodes"], instruction: "Return only: series and episodes." },
  { name: "world", keys: ["characters", "locations", "props"], instruction: "Return only: characters, locations and props." },
  { name: "notes", keys: ["production_requirements", "conflicts", "section_kinds", "typed_brief_use"],
    instruction: "Return only: production_requirements, conflicts, section_kinds (every section in the input) and typed_brief_use." },
].map((p) => ({ ...p, schema: part(...p.keys) }));

export const REQUIREMENT_CATEGORIES = ["format", "look", "references", "generation", "sound", "music", "edit", "vfx", "subtitles", "delivery", "other"];

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const orNull = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Model output (plain types) → Intake, with allowed values enforced. */
export function normalizeIntake(r: Raw): Intake {
  const se = r.series ?? {};
  return {
    series: {
      title: se.title ?? "", title_alt: orNull(se.title_alt), logline: se.logline ?? "",
      episode_count: Number(se.episode_count) || 0, setting: se.setting ?? "", era: se.era ?? "",
      language: se.language ?? "", dialogue_script: se.dialogue_script ?? "", tone: se.tone ?? "",
      format: { aspect_ratio: orNull(se.aspect_ratio), fps: Number(se.fps) || null, episode_length: orNull(se.episode_length) },
      sources: se.sources ?? [],
    },
    episodes: (r.episodes ?? []).map((e: Raw) => ({
      number: e.number, title: e.title ?? "", title_en: orNull(e.title_en), runtime: orNull(e.runtime),
      summary: e.summary ?? "", ends_on: orNull(e.ends_on),
      script: {
        status: ["screenplay", "outline", "none"].includes(e.script_status) ? e.script_status : "none",
        sections: e.script_sections ?? [], note: orNull(e.script_note),
      },
      sources: e.sources ?? [],
    })),
    characters: (r.characters ?? []).map((c: Raw) => ({
      key: c.key, name: c.name, aliases: c.aliases ?? [], ages: c.ages ?? [], role: c.role ?? "",
      description: c.description ?? "", appearance: orNull(c.appearance), speaks: !!c.speaks,
      first_episode: Number(c.first_episode) || null, relationships: c.relationships ?? [], sources: c.sources ?? [],
    })),
    locations: r.locations ?? [],
    props: r.props ?? [],
    production_requirements: (r.production_requirements ?? []).map((q: Raw) => ({
      ...q, category: REQUIREMENT_CATEGORIES.includes(q.category) ? q.category : "other",
    })),
    conflicts: (r.conflicts ?? []).map((c: Raw) => ({
      id: c.id, topic: c.topic, severity: c.severity === "minor" ? "minor" : "changes_production",
      description: c.description ?? "", options: c.options ?? [], recommendation: orNull(c.recommendation),
    })),
    section_kinds: (r.section_kinds ?? []).map((k: Raw) => ({
      ref: k.ref, kind: (SECTION_KINDS as readonly string[]).includes(k.kind) ? k.kind : "other",
    })),
    typed_brief_use: orNull(r.typed_brief_use),
  };
}

export type Intake = {
  series: {
    title: string; title_alt: string | null; logline: string; episode_count: number;
    setting: string; era: string; language: string; dialogue_script: string; tone: string;
    format: { aspect_ratio: string | null; fps: number | null; episode_length: string | null };
    sources: string[];
  };
  episodes: {
    number: number; title: string; title_en: string | null; runtime: string | null; summary: string; ends_on: string | null;
    script: { status: "screenplay" | "outline" | "none"; sections: string[]; note: string | null };
    sources: string[];
  }[];
  characters: {
    key: string; name: string; aliases: string[]; ages: { period: string; age: string; sources: string[] }[];
    role: string; description: string; appearance: string | null; speaks: boolean; first_episode: number | null;
    relationships: { with: string; relation: string }[]; sources: string[];
  }[];
  locations: { key: string; name: string; description: string; episodes: number[]; sources: string[] }[];
  props: { key: string; name: string; description: string; sources: string[] }[];
  production_requirements: { category: string; text: string; sources: string[] }[];
  conflicts: {
    id: string; topic: string; severity: "changes_production" | "minor"; description: string;
    options: { value: string; sources: string[] }[]; recommendation: string | null;
    resolution?: { choice: number | null; note: string } | null;
  }[];
  section_kinds: { ref: string; kind: (typeof SECTION_KINDS)[number] }[];
  typed_brief_use: string | null;
};

export const INTAKE_PROMPT_VERSION = "intake v2 (2026-11-26)";

export const INTAKE_SYSTEM = `# ${INTAKE_PROMPT_VERSION}

You read the source documents for a new vertical microdrama series and extract what a production team needs before any visuals are made.

The input lists every document as numbered sections like [d1:s12]. One document may be text the user typed into the app; treat it as the user's current instructions and let it override older documents where they clash, but still report the clash as a conflict.

Extract:
- series: title (and an alternative title if one appears), a one-sentence logline, episode count, setting, era, spoken language, the script used for dialogue (for example "Devanagari"), tone, and format.
- episodes: every planned episode with number, title, English title if given, runtime, a 2–3 sentence summary, and what it ends on. For script, say "screenplay" when the sources contain the scene-by-scene script with dialogue, "outline" when only a description exists, and list the sections that contain it.
- characters: everyone who appears or is named, with ages exactly as the sources state them, per period (for example "2014: about five"; "present day: seventeen"). Never invent or estimate an age. Mark speaks=true if they have dialogue anywhere.
- locations, props and vehicles that need visual references.
- production_requirements: format, look, reference, generation, sound, music, edit, VFX, subtitle and delivery requirements, each as one plain sentence.
- conflicts: places where the sources disagree in a way that would change production — different ages, names, endings, runtimes, wardrobe, episode order, or a typed instruction that contradicts a document. Give each option with its sources and, if one is clearly newer or more specific, a recommendation. Do not report differences of wording.
- section_kinds: classify every section: series_overview, screenplay (scene text and dialogue), production_note (direction for the team), sample_prompt (ready-made generation prompts), coverage_table (shot or clip lists), reference_guidance (what references to make), post_production (edit, colour, sound, music), other.

Output conventions:
- Use an empty string for anything not stated, and 0 for an unknown number.
- script_status is "screenplay", "outline" or "none". severity is "changes_production" or "minor".
- production requirement category is one of: format, look, references, generation, sound, music, edit, vfx, subtitles, delivery, other.
- section kind is one of: series_overview, screenplay, production_note, sample_prompt, coverage_table, reference_guidance, post_production, other.

Rules:
- Cite sections in every "sources" list. Only cite references that exist in the input.
- Copy names and dialogue in their original script. Never translate titles; put English titles in title_en only when the source gives one.
- Do not invent characters, places, episodes or facts. If something is not in the sources, leave it null or empty.`;
