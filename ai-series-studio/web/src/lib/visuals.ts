import { q, one, tx, logEvent } from "./db";
import { enqueue } from "./jobs";
import { runStructured } from "./llm";
import { readStored, storeFile } from "./storage";
import { generateImage, imageProvider, type RefImage } from "./images";
import type { Intake } from "./intakeSchema";

export type Category = "character" | "wardrobe" | "location" | "prop";
type View = { view: string; label: string; aspect: string; instr: string };

/** What the user reviews for each kind of item (release-1 spec, step 2). */
export const VIEWS: Record<Category, View[]> = {
  character: [
    { view: "face", label: "Face close-up", aspect: "3:4", instr: "Head-and-shoulders close-up portrait facing the camera, neutral expression, plain soft background, even daylight. Show the face, hair and distinctive features clearly." },
    { view: "full_body", label: "Full body, front and side", aspect: "16:9", instr: "Character turnaround on a plain light background: the same person full body, front view on the left and side view on the right, standing naturally, same outfit." },
    { view: "expressions", label: "Expressions", aspect: "16:9", instr: "Expression sheet: the same person's head and shoulders shown four times in a row, calm, worried, frightened and smiling, same lighting and outfit." },
  ],
  wardrobe: [
    { view: "outfit", label: "Outfit on the character", aspect: "9:16", instr: "Full-body front view of this exact person wearing the outfit on a plain light background, the whole outfit visible from head to toe including footwear." },
    { view: "details", label: "Details and accessories", aspect: "1:1", instr: "Close-up of the outfit's important details and accessories (fabric pattern, jewellery, footwear, bag) laid out on a neutral surface." },
  ],
  location: [
    { view: "establishing", label: "Establishing view", aspect: "9:16", instr: "Establishing wide shot of the place in a vertical frame, no people, in the story's light and time of day." },
    { view: "angle", label: "Second angle and layout", aspect: "9:16", instr: "A second angle of the same place, a reverse or interior view that shows entrances and layout, matching the first view, no people." },
  ],
  prop: [
    { view: "three_quarter", label: "Three-quarter view", aspect: "1:1", instr: "The object alone in a clear three-quarter view on a neutral background, true colours and materials." },
    { view: "detail_scale", label: "Detail and scale", aspect: "1:1", instr: "The same object from another useful angle with a close detail, and a hand or common object for scale where size matters." },
  ],
};

const PROTECTED = "This person is a child or a minor: fully clothed exactly as described, natural age-appropriate pose and expression, nothing revealing.";
const BUDGET_CENTS = Number(process.env.PROJECT_IMAGE_BUDGET_USD ?? 25) * 100;

export type Item = {
  id: string; project_id: string; category: Category; key: string; name: string; description: string; base_prompt: string;
  parent_key: string | null; episodes: number[]; required: boolean; protected: boolean; reference_hint: string | null;
  status: string; approved_version_id: string | null; flag_reason: string | null; sort: number;
};
type Version = {
  id: string; item_id: string; n: number; prompt: string; views: string[]; status: string; provider: string | null;
  base_version_id: string | null; keep_identity: boolean; reference_shas: string[]; est_cents: string;
};

// ---------- Planning the list of items ----------

const str = { type: "string" } as const;
const PLAN_SCHEMA = {
  type: "object", additionalProperties: false, required: ["style", "items"],
  properties: {
    style: str,
    items: { type: "array", items: { type: "object", additionalProperties: false,
      required: ["category", "key", "name", "description", "prompt", "parent_key", "episodes", "required", "protected", "reference_hint"],
      properties: {
        category: str, key: str, name: str, description: str, prompt: str, parent_key: str,
        episodes: { type: "array", items: { type: "integer" } }, required: { type: "boolean" }, protected: { type: "boolean" }, reference_hint: str,
      } } },
  },
};

export const PLAN_SYSTEM = `# visual_plan v1 (2026-11-26)

You plan the visual references a production team must approve before any video is generated for a vertical microdrama.

Input: the approved series summary (series, episodes, characters with ages as stated, locations, props, production requirements).

Return:
- style: one paragraph describing the photographic look shared by every reference image (light, colour, lens, texture, era), taken from the summary.
- items: one entry per thing to approve, in this order: characters, then wardrobe, then locations, then props.
  - character: one item per distinct look of a person. A character seen at several ages or eras gets one item per age or era (for example a boy at five, eight, eleven, thirteen and seventeen; parents in 2014 and twelve years later). parent_key is the key of the earlier look this one must resemble, or "".
  - wardrobe: one item per outfit or important accessory worn in the episodes, with parent_key set to the character look that wears it.
  - location: one item per place, including important time-of-day variants.
  - prop: one item per object or vehicle the story depends on.
- key: short lowercase snake_case, unique. name: plain words, for example "Veer at eight".
- description: 1–3 sentences a person reads to approve it, using only facts in the summary.
- prompt: a precise image-generation description of the subject only (no camera framing; the app adds views): age, build, face, hair, skin, clothing, materials, colours, era, place. Never name real people or actors. Use only facts in the summary; where a detail is missing, choose something plain and consistent with the setting and say so in description.
- episodes: the episode numbers where it appears.
- required: true if it appears in an episode that still has to be produced; false if it only appears in an episode already made.
- protected: true for anyone under 18 or whose age is not clearly adult.
- reference_hint: where an existing image of it can be found according to the summary (for example "Episode 1 at 01:25"), or "".`;

export async function planVisuals(projectId: string) {
  await q("UPDATE projects SET visuals_status='planning', updated_at=now() WHERE id=$1", [projectId]);
  const row = await one<{ summary: Intake }>("SELECT summary FROM intake WHERE project_id=$1", [projectId]);
  if (!row) throw Object.assign(new Error("No step 1 summary yet."), { retryable: false });
  const s = row.summary;
  const input = JSON.stringify({
    series: s.series, episodes: s.episodes.map((e) => ({ number: e.number, title: e.title, summary: e.summary, ends_on: e.ends_on, script: e.script.status })),
    characters: s.characters, locations: s.locations, props: s.props,
    production_requirements: s.production_requirements.filter((r) => ["look", "references", "format"].includes(r.category)),
    typed_brief_use: s.typed_brief_use,
    resolved_conflicts: s.conflicts.filter((c) => c.resolution).map((c) => ({ topic: c.topic, chosen: c.resolution!.choice === null ? c.resolution!.note : c.options[c.resolution!.choice]?.value })),
  });
  try {
    const res = await runStructured<{ style: string; items: (Omit<Item, "id" | "project_id" | "status" | "approved_version_id" | "flag_reason" | "sort" | "base_prompt"> & { prompt: string })[] }>({
      role: "visual_plan", system: PLAN_SYSTEM, input, schema: PLAN_SCHEMA, projectId,
    });
    const cats: Category[] = ["character", "wardrobe", "location", "prop"];
    await tx(async (c) => {
      await c.query("DELETE FROM visual_items WHERE project_id=$1 AND status='todo' AND NOT EXISTS (SELECT 1 FROM visual_versions v WHERE v.item_id=visual_items.id)", [projectId]);
      for (const [i, it] of res.data.items.entries()) {
        if (!cats.includes(it.category as Category)) continue;
        await c.query(
          `INSERT INTO visual_items (project_id, category, key, name, description, base_prompt, parent_key, episodes, required, protected, reference_hint, sort)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (project_id, key) DO UPDATE SET name=excluded.name, description=excluded.description, base_prompt=excluded.base_prompt,
             parent_key=excluded.parent_key, episodes=excluded.episodes, required=excluded.required, protected=excluded.protected,
             reference_hint=excluded.reference_hint, sort=excluded.sort, updated_at=now()`,
          [projectId, it.category, it.key, it.name, it.description, it.prompt, it.parent_key || null, it.episodes, it.required, it.protected, it.reference_hint || null, i],
        );
      }
      await c.query("UPDATE projects SET visuals_status='ready', visual_style=$2, updated_at=now() WHERE id=$1", [projectId, res.data.style]);
    });
    await logEvent(projectId, "visuals.planned", { items: res.data.items.length });
  } catch (e) {
    await q("UPDATE projects SET visuals_status='failed', updated_at=now() WHERE id=$1", [projectId]);
    throw e;
  }
}

// ---------- Versions, references, generation ----------

async function nextN(itemId: string) {
  const r = await one<{ n: number }>("SELECT COALESCE(MAX(n),0)+1 AS n FROM visual_versions WHERE item_id=$1", [itemId]);
  return r!.n;
}

export function estimateCents(views: number) {
  return views * imageProvider().centsPerImage("2K");
}

export async function createDraft(item: Item, opts: { prompt?: string; views?: string[]; base?: string | null; change?: string; understood?: string; keepIdentity?: boolean } = {}) {
  const views = opts.views?.length ? opts.views : VIEWS[item.category].map((v) => v.view);
  const v = await one<{ id: string }>(
    `INSERT INTO visual_versions (item_id, n, prompt, change_request, understood, views, status, base_version_id, keep_identity, est_cents)
     VALUES ($1,$2,$3,$4,$5,$6,'draft',$7,$8,$9) RETURNING id`,
    [item.id, await nextN(item.id), opts.prompt ?? item.base_prompt, opts.change ?? null, opts.understood ?? null, views,
     opts.base ?? null, opts.keepIdentity ?? true, estimateCents(views.length)],
  );
  return v!.id;
}

export async function spentCents(projectId: string) {
  const r = await one<{ c: string }>("SELECT COALESCE(SUM(cents),0) AS c FROM spend WHERE project_id=$1", [projectId]);
  return Number(r!.c);
}

/** Queue a draft for generation after checking the project's image budget. */
export async function queueVersion(versionId: string) {
  const v = await one<Version & { project_id: string }>(
    "SELECT v.*, i.project_id FROM visual_versions v JOIN visual_items i ON i.id=v.item_id WHERE v.id=$1", [versionId]);
  if (!v) throw new Error("version not found");
  if (v.status !== "draft" && v.status !== "failed") return v.status;
  if (imageProvider().name === "none") throw new Error("Image generation needs GEMINI_API_KEY in web/.env.local.");
  const pending = await one<{ c: string }>(
    `SELECT COALESCE(SUM(v.est_cents),0) AS c FROM visual_versions v JOIN visual_items i ON i.id=v.item_id
     WHERE i.project_id=$1 AND v.status IN ('queued','generating')`, [v.project_id]);
  if ((await spentCents(v.project_id)) + Number(pending!.c) + Number(v.est_cents) > BUDGET_CENTS) {
    throw new Error(`This would pass the project's image budget of $${(BUDGET_CENTS / 100).toFixed(0)}. Raise PROJECT_IMAGE_BUDGET_USD to continue.`);
  }
  await q("UPDATE visual_versions SET status='queued', error=NULL WHERE id=$1", [versionId]);
  await q("UPDATE visual_items SET status='generating', updated_at=now() WHERE id=$1", [v.item_id]);
  await enqueue("visuals.generate", v.project_id, { versionId });
  return "queued";
}

async function imagesOf(versionId: string | null, views?: string[]) {
  if (!versionId) return [];
  const rows = await q<{ view: string; file_sha: string; prompt: string }>("SELECT view, file_sha, prompt FROM visual_images WHERE version_id=$1", [versionId]);
  return views ? rows.filter((r) => views.includes(r.view)) : rows;
}

/** Reference images for one version, in priority order, as the spec asks: approved references first. */
async function referencesFor(item: Item, v: Version): Promise<{ sha: string; role: RefImage["role"] }[]> {
  const out: { sha: string; role: RefImage["role"] }[] = [];
  const personal = item.category === "character" || item.category === "wardrobe";
  // 1. Images the user uploaded for this item.
  const uploads = await q<{ file_sha: string }>(
    "SELECT im.file_sha FROM visual_images im JOIN visual_versions vv ON vv.id=im.version_id WHERE vv.item_id=$1 AND vv.provider='upload' ORDER BY vv.n DESC LIMIT 3", [item.id]);
  uploads.forEach((u) => out.push({ sha: u.file_sha, role: personal ? "character" : "object" }));
  // 2. The approved parent look (an outfit's wearer, or the earlier age of a character).
  if (item.parent_key) {
    const parent = await one<{ approved_version_id: string | null }>("SELECT approved_version_id FROM visual_items WHERE project_id=$1 AND key=$2", [item.project_id, item.parent_key]);
    for (const im of await imagesOf(parent?.approved_version_id ?? null, ["reference", "face", "full_body", "outfit", "establishing"])) out.push({ sha: im.file_sha, role: personal ? "character" : "object" });
  }
  // 3. For a change that keeps identity: the version being changed.
  if (v.base_version_id && v.keep_identity) {
    for (const im of await imagesOf(v.base_version_id)) out.push({ sha: im.file_sha, role: personal ? "character" : "object" });
  }
  const seen = new Set<string>();
  return out.filter((r) => (seen.has(r.sha) ? false : (seen.add(r.sha), true)));
}

export async function runGeneration(versionId: string) {
  const v = await one<Version>("SELECT * FROM visual_versions WHERE id=$1", [versionId]);
  if (!v) return;
  const item = (await one<Item>("SELECT * FROM visual_items WHERE id=$1", [v.item_id]))!;
  const style = (await one<{ visual_style: string | null }>("SELECT visual_style FROM projects WHERE id=$1", [item.project_id]))!.visual_style ?? "";
  await q("UPDATE visual_versions SET status='generating' WHERE id=$1", [versionId]);
  try {
    const refs = await referencesFor(item, v);
    const refImages: RefImage[] = [];
    for (const r of refs) {
      const f = await readStored(r.sha);
      if (f.mime === "image/svg+xml") continue; // placeholders are not real references
      refImages.push({ mime: f.mime, data: f.buf, role: r.role });
    }
    // Views not regenerated are carried over from the base version unchanged.
    const carry = await imagesOf(v.base_version_id);
    for (const im of carry.filter((c) => !v.views.includes(c.view))) {
      await q("INSERT INTO visual_images (version_id, view, file_sha, prompt) VALUES ($1,$2,$3,$4)", [versionId, im.view, im.file_sha, im.prompt]);
    }
    let cents = 0;
    for (const viewName of v.views) {
      const view = VIEWS[item.category].find((x) => x.view === viewName);
      if (!view) continue;
      const prompt = [
        style && `Look: ${style}`,
        `Subject: ${v.prompt}`,
        `This image: ${view.instr}`,
        refImages.length ? "Match the reference images exactly for the face, hair, skin tone, build and any clothing they show, unless the subject description says otherwise." : "",
        item.protected ? PROTECTED : "",
        "Photorealistic. No text, captions, labels or watermarks in the image.",
      ].filter(Boolean).join("\n\n");
      const out = await generateImage({ prompt, refs: refImages, aspect: view.aspect, size: "2K" });
      const sha = await storeFile(out.buf, out.mime, "generated");
      await q("INSERT INTO visual_images (version_id, view, file_sha, prompt) VALUES ($1,$2,$3,$4)", [versionId, viewName, sha, prompt]);
      if (out.cents) await q("INSERT INTO spend (project_id, category, provider, model, cents, ref_id) VALUES ($1,'image',$2,$3,$4,$5)", [item.project_id, out.provider, out.model, out.cents, versionId]);
      cents += out.cents;
      await q("UPDATE visual_versions SET provider=$2, model=$3, cost_cents=$4 WHERE id=$1", [versionId, out.provider, out.model, cents]);
    }
    await q("UPDATE visual_versions SET status='ready', reference_shas=$2 WHERE id=$1", [versionId, refs.map((r) => r.sha)]);
    await q("UPDATE visual_items SET status=CASE WHEN status='generating' THEN 'review' ELSE status END, updated_at=now() WHERE id=$1", [item.id]);
  } catch (e) {
    await q("UPDATE visual_versions SET status='failed', error=$2 WHERE id=$1", [versionId, String((e as Error).message).slice(0, 1000)]);
    await q("UPDATE visual_items SET status=CASE WHEN approved_version_id IS NULL THEN 'todo' ELSE 'approved' END, updated_at=now() WHERE id=$1", [item.id]);
    throw Object.assign(e as Error, { retryable: false });
  }
}

// ---------- Approve, upload, change ----------

export async function approveVersion(versionId: string) {
  const v = await one<Version>("SELECT * FROM visual_versions WHERE id=$1", [versionId]);
  if (!v || v.status !== "ready") throw new Error("Only a finished version can be approved.");
  const item = (await one<Item>("SELECT * FROM visual_items WHERE id=$1", [v.item_id]))!;
  const changed = item.approved_version_id && item.approved_version_id !== versionId;
  await q("UPDATE visual_items SET approved_version_id=$2, status='approved', flag_reason=NULL, updated_at=now() WHERE id=$1", [item.id, versionId]);
  let flagged: string[] = [];
  if (changed) {
    // Only dependents already approved or under review need a second look.
    const deps = await q<{ name: string }>(
      `UPDATE visual_items SET status='flagged', flag_reason=$3, updated_at=now()
       WHERE project_id=$1 AND parent_key=$2 AND status IN ('approved','review') RETURNING name`,
      [item.project_id, item.key, `${item.name} changed. Check this still matches the new look.`]);
    flagged = deps.map((d) => d.name);
  }
  await logEvent(item.project_id, "visuals.approved", { item: item.key, version: v.n, flagged });
  return { flagged };
}

export async function addUpload(item: Item, buf: Buffer, mime: string) {
  const sha = await storeFile(buf, mime, "upload");
  const v = await one<{ id: string }>(
    `INSERT INTO visual_versions (item_id, n, prompt, views, status, provider, model, understood)
     VALUES ($1,$2,$3,$4,'ready','upload','upload','Your image, used as is and as a reference for new versions.') RETURNING id`,
    [item.id, await nextN(item.id), item.base_prompt, ["reference"]]);
  await q("INSERT INTO visual_images (version_id, view, file_sha, prompt) VALUES ($1,'reference',$2,'Uploaded by the user')", [v!.id, sha]);
  await q("UPDATE visual_items SET status=CASE WHEN status IN ('todo','generating') THEN 'review' ELSE status END, updated_at=now() WHERE id=$1", [item.id]);
  return v!.id;
}

const CHANGE_SCHEMA = {
  type: "object", additionalProperties: false, required: ["understood", "prompt", "views", "keep_identity"],
  properties: { understood: str, prompt: str, views: { type: "array", items: str }, keep_identity: { type: "boolean" } },
};

export async function interpretChange(item: Item, baseVersionId: string, request: string) {
  const base = await one<Version>("SELECT * FROM visual_versions WHERE id=$1", [baseVersionId]);
  if (!base) throw new Error("version not found");
  const views = VIEWS[item.category];
  const res = await runStructured<{ understood: string; prompt: string; views: string[]; keep_identity: boolean }>({
    role: "visual_change",
    model: "claude-sonnet-5-5",
    projectId: item.project_id,
    system: `# visual_change v1 (2026-11-26)

You turn a reviewer's plain-words change request for one reference image set into a precise instruction for an image model.

Return:
- understood: one short sentence, addressed to the reviewer, saying what will change and what stays the same.
- prompt: the full revised subject description (not just the change), keeping every detail the request does not change.
- views: which of the listed views must be regenerated; leave out views the change does not affect.
- keep_identity: true if the person's or object's identity must stay the same (use the current images as references); false only if the reviewer asks for a different face or a different object.
If the request would make a child's depiction revealing or unsafe, keep the original clothing and say so in understood.`,
    input: JSON.stringify({
      item: { category: item.category, name: item.name, description: item.description, protected: item.protected },
      current_prompt: base.prompt,
      views: views.map((v) => ({ view: v.view, shows: v.label })),
      request,
    }),
    schema: CHANGE_SCHEMA,
  });
  const valid = res.data.views.filter((x) => views.some((v) => v.view === x));
  return createDraft(item, {
    prompt: res.data.prompt, views: valid.length ? valid : views.map((v) => v.view), base: base.provider === "upload" ? null : baseVersionId,
    change: request, understood: res.data.understood, keepIdentity: res.data.keep_identity,
  });
}

// ---------- Finish step 2 ----------

export async function finishVisuals(projectId: string) {
  const open = await q<{ name: string }>(
    "SELECT name FROM visual_items WHERE project_id=$1 AND required AND (status<>'approved' OR approved_version_id IS NULL)", [projectId]);
  if (open.length) throw new Error(`Approve ${open.length} more required item(s) first: ${open.slice(0, 4).map((o) => o.name).join(", ")}${open.length > 4 ? "…" : ""}`);
  const items = await q<Item & { prompt: string; n: number }>(
    `SELECT i.*, v.prompt, v.n FROM visual_items i JOIN visual_versions v ON v.id=i.approved_version_id WHERE i.project_id=$1 ORDER BY i.sort`, [projectId]);
  const snapshot: Record<string, unknown>[] = [];
  for (const it of items) {
    snapshot.push({
      key: it.key, category: it.category, name: it.name, description: it.description, parent_key: it.parent_key,
      episodes: it.episodes, protected: it.protected, version: it.n, prompt: it.prompt,
      images: (await imagesOf(it.approved_version_id)).map((im) => ({ view: im.view, file_sha: im.file_sha })),
    });
  }
  const style = (await one<{ visual_style: string | null }>("SELECT visual_style FROM projects WHERE id=$1", [projectId]))!.visual_style;
  const ver = (await one<{ n: number }>("SELECT COALESCE(MAX(version),0)+1 AS n FROM bible_versions WHERE project_id=$1", [projectId]))!.n;
  await tx(async (c) => {
    await c.query("INSERT INTO bible_versions (project_id, version, snapshot) VALUES ($1,$2,$3)", [projectId, ver, JSON.stringify({ visual_style: style, visuals: snapshot })]);
    await c.query("UPDATE projects SET step=GREATEST(step,3), updated_at=now() WHERE id=$1", [projectId]);
  });
  await logEvent(projectId, "bible.saved", { version: ver, items: snapshot.length });
  return ver;
}
