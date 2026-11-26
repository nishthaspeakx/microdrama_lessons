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

export const intakeSchema = obj({
  series: obj({
    title: str, title_alt: nstr, logline: str, episode_count: { type: "integer" },
    setting: str, era: str, language: str, dialogue_script: str, tone: str,
    format: obj({ aspect_ratio: nstr, fps: { type: ["integer", "null"] }, episode_length: nstr }),
    sources: refs,
  }),
  episodes: {
    type: "array",
    items: obj({
      number: { type: "integer" }, title: str, title_en: nstr, runtime: nstr, summary: str,
      ends_on: nstr,
      script: obj({ status: { type: "string", enum: ["screenplay", "outline", "none"] }, sections: refs, note: nstr }),
      sources: refs,
    }),
  },
  characters: {
    type: "array",
    items: obj({
      key: str, name: str, aliases: { type: "array", items: str },
      ages: { type: "array", items: obj({ period: str, age: str, sources: refs }) },
      role: str, description: str, appearance: nstr, speaks: { type: "boolean" },
      first_episode: { type: ["integer", "null"] },
      relationships: { type: "array", items: obj({ with: str, relation: str }) },
      sources: refs,
    }),
  },
  locations: { type: "array", items: obj({ key: str, name: str, description: str, episodes: { type: "array", items: { type: "integer" } }, sources: refs }) },
  props: { type: "array", items: obj({ key: str, name: str, description: str, sources: refs }) },
  production_requirements: {
    type: "array",
    items: obj({
      category: { type: "string", enum: ["format", "look", "references", "generation", "sound", "music", "edit", "vfx", "subtitles", "delivery", "other"] },
      text: str, sources: refs,
    }),
  },
  conflicts: {
    type: "array",
    items: obj({
      id: str, topic: str, severity: { type: "string", enum: ["changes_production", "minor"] },
      description: str,
      options: { type: "array", items: obj({ value: str, sources: refs }) },
      recommendation: nstr,
    }),
  },
  section_kinds: { type: "array", items: obj({ ref: str, kind: { type: "string", enum: [...SECTION_KINDS] } }) },
  typed_brief_use: nstr,
});

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

export const INTAKE_PROMPT_VERSION = "intake v1 (2026-11-26)";

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

Rules:
- Cite sections in every "sources" list. Only cite references that exist in the input.
- Copy names and dialogue in their original script. Never translate titles; put English titles in title_en only when the source gives one.
- Do not invent characters, places, episodes or facts. If something is not in the sources, leave it null or empty.`;
