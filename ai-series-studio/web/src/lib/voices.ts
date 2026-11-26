import { q, one, tx, logEvent } from "./db";
import { enqueue } from "./jobs";
import { runStructured } from "./llm";
import { readStored, storeFile } from "./storage";
import { designVoices, getVoice, saveDesignedVoice, speak, voiceProvider, DESIGN_MODEL, TTS_MODEL } from "./voice/provider";
import type { Intake } from "./intakeSchema";

export type Role = {
  id: string; project_id: string; key: string; name: string; portrait_item_key: string | null; voice_brief: string;
  audition_text: string; script_lines: string[]; reference_hint: string | null; reference_audio_sha: string | null;
  required: boolean; protected: boolean; status: string; locked_candidate_id: string | null;
};
type Candidate = {
  id: string; role_id: string; n: number; source: string; label: string; provider: string; provider_voice_id: string | null;
  generated_voice_id: string | null; description: string | null; text: string; status: string; audio_sha: string | null;
};

// ---------- Planning the roles ----------

const str = { type: "string" } as const;
const PLAN_SCHEMA = {
  type: "object", additionalProperties: false, required: ["roles", "pronunciations"],
  properties: {
    roles: { type: "array", items: { type: "object", additionalProperties: false,
      required: ["key", "name", "portrait_item_key", "voice_brief", "audition_text", "script_lines", "reference_hint", "required", "protected"],
      properties: {
        key: str, name: str, portrait_item_key: str, voice_brief: str, audition_text: str,
        script_lines: { type: "array", items: str }, reference_hint: str, required: { type: "boolean" }, protected: { type: "boolean" },
      } } },
    pronunciations: { type: "array", items: { type: "object", additionalProperties: false, required: ["written", "say_as", "note"],
      properties: { written: str, say_as: str, note: str } } },
  },
};

export const VOICE_PLAN_SYSTEM = `# voice_plan v1 (2026-11-26)

You plan voice casting for a vertical microdrama. Every speaking part gets one voice that stays the same across episodes.

Input: the series summary, the screenplay text of the episodes, and the list of approved or planned character looks (key and name).

Return roles: one per speaking part.
- One role per character, used across ages, unless the story clearly needs a different voice at another age (for example a small child who later appears as a teenager gets a separate teenage role). Do not create roles for people who never speak; a character who only "calls" someone with no words gets a role only if the script gives words or the summary says they speak.
- key: short snake_case. name: plain words, for example "Veer at seventeen".
- portrait_item_key: the key of the look whose face should be shown (from the looks list), or "".
- voice_brief: one paragraph for a voice designer: age, gender, region and accent (for example a central Indian Hindi accent), timbre, pace, emotional range. Hindi and Hinglish speech. Never name real actors.
- audition_text: 100 to 300 characters that every candidate voice will read. Use this character's own lines from the screenplay, exactly as written, in their original script (Devanagari stays Devanagari). If the lines are shorter than 100 characters, add one or two short in-character Hinglish sentences that fit the story and mark nothing else.
- script_lines: this character's lines from the screenplay, exactly as written.
- reference_hint: if an earlier episode already has this character speaking, say where (for example "Episode 1 at 00:57.7, डरो मत। तुम्हें चोट लगी है?"), else "".
- required: true if the character speaks in an episode still to be produced.
- protected: true for anyone under 18 or not clearly adult.

Return pronunciations: names of people and places and recurring words a text-to-speech voice may say wrongly. say_as is ONLY the replacement text the voice will read (a Devanagari or simple Roman respelling), with no brackets or explanations, because it is substituted into the line as is. Put any explanation in note. Only include words that appear in the input.`;

export async function planVoices(projectId: string) {
  await q("UPDATE projects SET voices_status='planning', updated_at=now() WHERE id=$1", [projectId]);
  try {
    const row = await one<{ summary: Intake }>("SELECT summary FROM intake WHERE project_id=$1", [projectId]);
    if (!row) throw Object.assign(new Error("No step 1 summary yet."), { retryable: false });
    const scripts = await q<{ ref: string; heading: string; text: string }>(
      "SELECT ref, heading, text FROM source_sections WHERE project_id=$1 AND kind='screenplay' ORDER BY ref", [projectId]);
    const looks = await q<{ key: string; name: string }>("SELECT key, name FROM visual_items WHERE project_id=$1 AND category='character' ORDER BY sort", [projectId]);
    const s = row.summary;
    const input = JSON.stringify({
      series: { title: s.series.title, language: s.series.language, dialogue_script: s.series.dialogue_script, setting: s.series.setting },
      episodes: s.episodes.map((e) => ({ number: e.number, title: e.title, summary: e.summary })),
      characters: s.characters.map((c) => ({ name: c.name, ages: c.ages, speaks: c.speaks, description: c.description })),
      typed_brief_use: s.typed_brief_use,
      screenplay: scripts.map((x) => `[${x.ref}] ${x.heading}\n${x.text}`).join("\n\n"),
      looks,
    });
    const res = await runStructured<{ roles: (Omit<Role, "id" | "project_id" | "status" | "locked_candidate_id" | "reference_audio_sha">)[]; pronunciations: { written: string; say_as: string; note: string }[] }>({
      role: "voice_plan", system: VOICE_PLAN_SYSTEM, input, schema: PLAN_SCHEMA, projectId,
    });
    await tx(async (c) => {
      await c.query("DELETE FROM voice_roles WHERE project_id=$1 AND status='todo' AND NOT EXISTS (SELECT 1 FROM voice_candidates v WHERE v.role_id=voice_roles.id)", [projectId]);
      for (const [i, r] of res.data.roles.entries()) {
        await c.query(
          `INSERT INTO voice_roles (project_id, key, name, portrait_item_key, voice_brief, audition_text, script_lines, reference_hint, required, protected, sort)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (project_id, key) DO UPDATE SET name=excluded.name, portrait_item_key=excluded.portrait_item_key, script_lines=excluded.script_lines,
             reference_hint=excluded.reference_hint, required=excluded.required, protected=excluded.protected, sort=excluded.sort, updated_at=now()`,
          [projectId, r.key, r.name, r.portrait_item_key || null, r.voice_brief, r.audition_text, JSON.stringify(r.script_lines), r.reference_hint || null, r.required, r.protected, i],
        );
      }
      for (const p of res.data.pronunciations) {
        const clean = cleanSayAs(p.say_as, p.note);
        if (!clean.say_as) continue;
        await c.query("INSERT INTO pronunciations (project_id, written, say_as, note, active) VALUES ($1,$2,$3,$4,false) ON CONFLICT (project_id, written) DO NOTHING",
          [projectId, p.written, clean.say_as, clean.note]);
      }
      await c.query("UPDATE projects SET voices_status='ready', updated_at=now() WHERE id=$1", [projectId]);
    });
    await logEvent(projectId, "voices.planned", { roles: res.data.roles.length });
  } catch (e) {
    await q("UPDATE projects SET voices_status='failed', updated_at=now() WHERE id=$1", [projectId]);
    throw e;
  }
}

// ---------- Pronunciation ----------

/** say_as is read aloud, so keep only the respelling; move anything in brackets to the note. */
export function cleanSayAs(sayAs: string, note: string | null = null) {
  const extra = [...sayAs.matchAll(/[(（\[]([^)）\]]*)[)）\]]/g)].map((m) => m[1].trim()).filter(Boolean);
  const say = sayAs.replace(/[(（\[][^)）\]]*[)）\]]/g, "").replace(/\s+/g, " ").trim();
  return { say_as: say, note: [note?.trim(), ...extra].filter(Boolean).join("; ") || null };
}

/** Apply the project's notes by plain substitution, longest written form first. */
export async function applyPronunciations(projectId: string, text: string) {
  const rules = await q<{ written: string; say_as: string }>("SELECT written, say_as FROM pronunciations WHERE project_id=$1 AND active", [projectId]);
  return rules.sort((a, b) => b.written.length - a.written.length).reduce((t, r) => t.split(r.written).join(r.say_as), text);
}

// ---------- Candidates ----------

function requireProvider() {
  if (voiceProvider() === "none") throw new Error("Voices need ELEVENLABS_API_KEY in web/.env.local.");
}

async function nextN(roleId: string) {
  return (await one<{ n: number }>("SELECT COALESCE(MAX(n),0)+1 AS n FROM voice_candidates WHERE role_id=$1", [roleId]))!.n;
}

export function checkAuditionText(text: string) {
  const len = [...text].length;
  if (len < 100) throw new Error(`The audition text has ${len} characters; Voice Design needs at least 100.`);
  if (len > 1000) throw new Error(`The audition text has ${len} characters; Voice Design allows at most 1,000.`);
}

/** Ask for three designed voices reading the role's audition text. */
export async function queueSuggestions(roleId: string) {
  requireProvider();
  const role = await one<Role>("SELECT * FROM voice_roles WHERE id=$1", [roleId]);
  if (!role) throw new Error("not found");
  checkAuditionText(role.audition_text);
  await q("UPDATE voice_roles SET status=CASE WHEN status='locked' THEN status ELSE 'generating' END, updated_at=now() WHERE id=$1", [roleId]);
  await enqueue("voices.design", role.project_id, { roleId });
}

export async function runDesign(roleId: string) {
  const role = (await one<Role>("SELECT * FROM voice_roles WHERE id=$1", [roleId]))!;
  try {
    const text = await applyPronunciations(role.project_id, role.audition_text);
    const ref = role.reference_audio_sha ? (await readStored(role.reference_audio_sha)).buf : undefined;
    const description = role.protected ? `${role.voice_brief} A young speaker; natural and age-appropriate.` : role.voice_brief;
    const { previews, cents } = await designVoices(description, text, ref);
    for (const [i, p] of previews.entries()) {
      const sha = await storeFile(p.audio, p.mime, "generated");
      const n = await nextN(roleId);
      await q(
        `INSERT INTO voice_candidates (role_id, n, source, label, provider, generated_voice_id, description, model, text, audio_sha, status, cost_cents)
         VALUES ($1,$2,'design',$3,$4,$5,$6,$7,$8,$9,'ready',$10)`,
        [roleId, n, `Suggestion ${n}`, voiceProvider(), p.generatedVoiceId, description, DESIGN_MODEL, role.audition_text, sha, i === 0 ? cents : 0],
      );
    }
    if (cents) await q("INSERT INTO spend (project_id, category, provider, model, cents) VALUES ($1,'voice','elevenlabs',$2,$3)", [role.project_id, DESIGN_MODEL, cents]);
    await q("UPDATE voice_roles SET status=CASE WHEN status='locked' THEN status ELSE 'review' END, updated_at=now() WHERE id=$1", [roleId]);
  } catch (e) {
    await q("UPDATE voice_roles SET status=CASE WHEN status='locked' THEN status WHEN EXISTS (SELECT 1 FROM voice_candidates WHERE role_id=$1) THEN 'review' ELSE 'todo' END, updated_at=now() WHERE id=$1", [roleId]);
    await logEvent(role.project_id, "voices.design_failed", { role: role.key, error: String((e as Error).message) });
    throw Object.assign(e as Error, { retryable: false });
  }
}

/** A Voice ID the user already knows: check the account can use it, then make it read the audition text. */
export async function addPastedVoice(roleId: string, voiceId: string) {
  requireProvider();
  const role = await one<Role>("SELECT * FROM voice_roles WHERE id=$1", [roleId]);
  if (!role) throw new Error("not found");
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(voiceId)) throw new Error("That does not look like an ElevenLabs Voice ID.");
  let info;
  try {
    info = await getVoice(voiceId);
  } catch (e) {
    throw new Error(`This account cannot use that voice. ${(e as Error).message}`);
  }
  const n = await nextN(roleId);
  const c = await one<{ id: string }>(
    `INSERT INTO voice_candidates (role_id, n, source, label, provider, provider_voice_id, description, model, text, status)
     VALUES ($1,$2,'pasted',$3,$4,$5,$6,$7,$8,'queued') RETURNING id`,
    [roleId, n, info.name, voiceProvider(), voiceId, info.description ?? info.category, TTS_MODEL, role.audition_text]);
  await enqueue("voices.speak", role.project_id, { candidateId: c!.id });
  return c!.id;
}

/** Speak the audition text with a candidate that has a real Voice ID (pasted, or saved on lock). */
export async function runSpeak(candidateId: string) {
  const c = (await one<Candidate & { project_id: string }>(
    "SELECT c.*, r.project_id FROM voice_candidates c JOIN voice_roles r ON r.id=c.role_id WHERE c.id=$1", [candidateId]))!;
  await q("UPDATE voice_candidates SET status='generating', error=NULL WHERE id=$1", [candidateId]);
  try {
    if (!c.provider_voice_id) throw new Error("This suggestion has no saved voice yet.");
    const out = await speak(c.provider_voice_id, await applyPronunciations(c.project_id, c.text));
    const sha = await storeFile(out.audio, out.mime, "generated");
    await q("UPDATE voice_candidates SET audio_sha=$2, status='ready', cost_cents=cost_cents+$3 WHERE id=$1", [candidateId, sha, out.cents]);
    if (out.cents) await q("INSERT INTO spend (project_id, category, provider, model, cents) VALUES ($1,'voice','elevenlabs',$2,$3)", [c.project_id, TTS_MODEL, out.cents]);
    await q("UPDATE voice_roles SET status=CASE WHEN status IN ('todo','generating') THEN 'review' ELSE status END, updated_at=now() WHERE id=$1", [c.role_id]);
  } catch (e) {
    await q("UPDATE voice_candidates SET status='failed', error=$2 WHERE id=$1", [candidateId, String((e as Error).message).slice(0, 800)]);
    throw Object.assign(e as Error, { retryable: false });
  }
}

/** Hear a candidate again with the current pronunciation notes. */
export async function queueReplay(candidateId: string) {
  requireProvider();
  const c = await one<Candidate & { project_id: string }>(
    "SELECT c.*, r.project_id FROM voice_candidates c JOIN voice_roles r ON r.id=c.role_id WHERE c.id=$1", [candidateId]);
  if (!c) throw new Error("not found");
  if (!c.provider_voice_id) throw new Error("Lock this suggestion first; a designed preview can only be replayed once it is saved as a voice.");
  await q("UPDATE voice_candidates SET status='queued' WHERE id=$1", [candidateId]);
  await enqueue("voices.speak", c.project_id, { candidateId });
}

/** Lock a voice to the role. A designed suggestion is saved as a permanent ElevenLabs voice first. */
export async function lockCandidate(candidateId: string) {
  requireProvider();
  const c = await one<Candidate & { project_id: string; role_name: string; voice_brief: string }>(
    `SELECT c.*, r.project_id, r.name AS role_name, r.voice_brief FROM voice_candidates c JOIN voice_roles r ON r.id=c.role_id WHERE c.id=$1`, [candidateId]);
  if (!c || c.status !== "ready") throw new Error("Only a finished audition can be locked.");
  let voiceId = c.provider_voice_id;
  if (!voiceId) {
    const series = (await one<{ name: string }>("SELECT name FROM projects WHERE id=$1", [c.project_id]))!.name;
    voiceId = await saveDesignedVoice(c.generated_voice_id!, `${series} · ${c.role_name}`.slice(0, 100), c.voice_brief.slice(0, 500));
    await q("UPDATE voice_candidates SET provider_voice_id=$2 WHERE id=$1", [candidateId, voiceId]);
  }
  await q("UPDATE voice_roles SET locked_candidate_id=$2, status='locked', updated_at=now() WHERE id=$1", [c.role_id, candidateId]);
  await logEvent(c.project_id, "voices.locked", { role: c.role_name, voiceId, model: TTS_MODEL });
  return { voiceId };
}

// ---------- Finish step 3 ----------

export async function finishVoices(projectId: string) {
  const open = await q<{ name: string }>("SELECT name FROM voice_roles WHERE project_id=$1 AND required AND status<>'locked'", [projectId]);
  if (open.length) throw new Error(`Lock ${open.length} more required voice(s) first: ${open.map((o) => o.name).join(", ")}`);
  const roles = await q<Role & { provider_voice_id: string; model: string; audio_sha: string; settings: unknown }>(
    `SELECT r.*, c.provider_voice_id, c.model, c.audio_sha, c.settings FROM voice_roles r JOIN voice_candidates c ON c.id=r.locked_candidate_id
     WHERE r.project_id=$1 ORDER BY r.sort`, [projectId]);
  const pron = await q("SELECT written, say_as, note FROM pronunciations WHERE project_id=$1 AND active ORDER BY written", [projectId]);
  const prev = await one<{ version: number; snapshot: Record<string, unknown> }>(
    "SELECT version, snapshot FROM bible_versions WHERE project_id=$1 ORDER BY version DESC LIMIT 1", [projectId]);
  const snapshot = {
    ...(prev?.snapshot ?? {}),
    voices: roles.map((r) => ({
      key: r.key, name: r.name, portrait_item_key: r.portrait_item_key, provider: "elevenlabs", voice_id: r.provider_voice_id,
      tts_model: TTS_MODEL, settings: r.settings, sample_sha: r.audio_sha, audition_text: r.audition_text, voice_brief: r.voice_brief,
    })),
    pronunciations: pron,
  };
  const ver = (prev?.version ?? 0) + 1;
  const visualsDone = !!(prev?.snapshot as { visuals?: unknown[] } | undefined)?.visuals;
  await tx(async (c) => {
    await c.query("INSERT INTO bible_versions (project_id, version, snapshot) VALUES ($1,$2,$3)", [projectId, ver, JSON.stringify(snapshot)]);
    if (visualsDone) await c.query("UPDATE projects SET step=GREATEST(step,4), updated_at=now() WHERE id=$1", [projectId]);
  });
  await logEvent(projectId, "bible.saved", { version: ver, voices: roles.length });
  return { bibleVersion: ver, visualsDone };
}
