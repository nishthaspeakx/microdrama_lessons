import { q, one, tx, logEvent } from "./db";
import { enqueue } from "./jobs";
import { runStructured } from "./llm";
import { readStored, storeFile } from "./storage";
import { generateImage, imageProvider, type RefImage } from "./images";
import type { Intake } from "./intakeSchema";

export type Category = "character" | "wardrobe" | "location" | "prop";
type View = { view: string; label: string; aspect: string; instr: string; derived?: boolean };

/** What the user reviews for each kind of item (release-1 spec, step 2). */
export const VIEWS: Record<Category, View[]> = {
  character: [
    // A portfolio like a casting sheet: front, back and face on one grey studio backdrop, plus side, expressions and details.
    { view: "portfolio", label: "Portfolio sheet", aspect: "16:9", instr: "", derived: true },
    { view: "full_front", label: "Full body, front", aspect: "9:16", instr: "Full-body front view, standing straight and facing the camera, arms relaxed at the sides, the whole figure from the top of the head to the feet including footwear, on a plain light-grey studio backdrop with soft, even studio light and a soft floor shadow." },
    { view: "full_back", label: "Full body, back", aspect: "9:16", instr: "Full-body back view of the same person, standing straight facing away from the camera, showing the hair from behind (plait, bun or cut) and the back of every garment, head to feet, on the same plain light-grey studio backdrop and light." },
    { view: "face", label: "Face close-up", aspect: "3:4", instr: "Face close-up portrait from the shoulders up, facing the camera with a calm natural expression, on the same plain light-grey studio backdrop with soft, even light. Show skin texture, eyes, brows, hairline and any distinctive marks clearly." },
    { view: "full_side", label: "Full body, side", aspect: "9:16", instr: "Full-body side profile of the same person facing left, standing naturally, head to feet, on the same plain light-grey studio backdrop and light." },
    { view: "expressions", label: "Expressions", aspect: "16:9", instr: "Expression sheet on the same plain light-grey backdrop: the same person's head and shoulders four times in a row, calm, worried, frightened and smiling, same lighting and outfit." },
    { view: "details", label: "Hair, hands, footwear and accessories", aspect: "1:1", instr: "A neat grid of close-ups on the same plain light-grey backdrop: the hairstyle from the side and back, the hands, the footwear, and any jewellery, accessories or distinctive features, all matching this person and outfit exactly." },
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
  change_set_id: string | null; wait_for_version_id: string | null; new_description: string | null;
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

export async function createDraft(item: Item, opts: {
  prompt?: string; views?: string[]; base?: string | null; change?: string; understood?: string; keepIdentity?: boolean;
  changeSetId?: string | null; waitFor?: string | null; newDescription?: string | null;
} = {}) {
  const views = (opts.views?.length ? opts.views : VIEWS[item.category].map((v) => v.view)).filter((v) => !VIEWS[item.category].find((x) => x.view === v)?.derived);
  const v = await one<{ id: string }>(
    `INSERT INTO visual_versions (item_id, n, prompt, change_request, understood, views, status, base_version_id, keep_identity, est_cents,
       change_set_id, wait_for_version_id, new_description)
     VALUES ($1,$2,$3,$4,$5,$6,'draft',$7,$8,$9,$10,$11,$12) RETURNING id`,
    [item.id, await nextN(item.id), opts.prompt ?? item.base_prompt, opts.change ?? null, opts.understood ?? null, views,
     opts.base ?? null, opts.keepIdentity ?? true, estimateCents(views.length), opts.changeSetId ?? null, opts.waitFor ?? null, opts.newDescription ?? null],
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
  if (!["draft", "failed", "waiting"].includes(v.status)) return v.status;
  if (imageProvider().name === "none") throw new Error("Image generation needs OPENAI_API_KEY (or GEMINI_API_KEY) in web/.env.local.");
  const pending = await one<{ c: string }>(
    `SELECT COALESCE(SUM(v.est_cents),0) AS c FROM visual_versions v JOIN visual_items i ON i.id=v.item_id
     WHERE i.project_id=$1 AND v.status IN ('queued','generating','waiting') AND v.id<>$2`, [v.project_id, versionId]);
  if ((await spentCents(v.project_id)) + Number(pending!.c) + Number(v.est_cents) > BUDGET_CENTS) {
    throw new Error(`This would pass the project's image budget of $${(BUDGET_CENTS / 100).toFixed(0)}. Raise PROJECT_IMAGE_BUDGET_USD to continue.`);
  }
  await q("UPDATE visual_items SET status='generating', updated_at=now() WHERE id=$1", [v.item_id]);
  if (v.wait_for_version_id) {
    const parent = await one<{ status: string }>("SELECT status FROM visual_versions WHERE id=$1", [v.wait_for_version_id]);
    if (parent && parent.status !== "ready") {
      await q("UPDATE visual_versions SET status='waiting', error=NULL WHERE id=$1", [versionId]);
      return "waiting";
    }
  }
  await q("UPDATE visual_versions SET status='queued', error=NULL WHERE id=$1", [versionId]);
  await enqueue("visuals.generate", v.project_id, { versionId });
  return "queued";
}

async function imagesOf(versionId: string | null, views?: string[]) {
  if (!versionId) return [];
  const rows = await q<{ view: string; file_sha: string; prompt: string }>("SELECT view, file_sha, prompt FROM visual_images WHERE version_id=$1", [versionId]);
  return views ? rows.filter((r) => views.includes(r.view)) : rows;
}

/** The images of the given views, in that order of preference, at most `max`. */
function pick<T extends { view: string }>(ims: T[], prefer: string[], max: number): T[] {
  return prefer.map((v) => ims.find((i) => i.view === v)).filter((x): x is T => !!x).slice(0, max);
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
    const parentVersion = v.wait_for_version_id ?? parent?.approved_version_id ?? null;
    // The parent's sheet and face (or its single key view): enough to carry identity, cheaper than every view.
    for (const im of pick(await imagesOf(parentVersion), ["reference", "portfolio", "face", "outfit", "establishing", "three_quarter"], 2)) out.push({ sha: im.file_sha, role: personal ? "character" : "object" });
  }
  // 3. For a change that keeps identity: the version being changed.
  if (v.base_version_id && v.keep_identity) {
    for (const im of pick(await imagesOf(v.base_version_id), ["portfolio", "face", "details", "outfit", "establishing", "angle", "three_quarter", "detail_scale"], 3)) out.push({ sha: im.file_sha, role: personal ? "character" : "object" });
  }
  const seen = new Set<string>();
  // At most six references: more adds cost (every reference is billed as input) without adding much likeness.
  return out.filter((r) => (seen.has(r.sha) ? false : (seen.add(r.sha), true))).slice(0, 6);
}

export async function runGeneration(versionId: string) {
  const v = await one<Version>("SELECT * FROM visual_versions WHERE id=$1", [versionId]);
  if (!v) return;
  const item = (await one<Item>("SELECT * FROM visual_items WHERE id=$1", [v.item_id]))!;
  const style = (await one<{ visual_style: string | null }>("SELECT visual_style FROM projects WHERE id=$1", [item.project_id]))!.visual_style ?? "";
  await q("UPDATE visual_versions SET status='generating', error=NULL WHERE id=$1", [versionId]);
  try {
    const refs = await referencesFor(item, v);
    const refImages: RefImage[] = [];
    for (const r of refs) {
      const f = await readStored(r.sha);
      if (f.mime === "image/svg+xml") continue; // placeholders are not real references
      refImages.push({ mime: f.mime, data: f.buf, role: r.role });
    }
    const have = new Set((await imagesOf(versionId)).map((i) => i.view));
    // Views not regenerated are carried over from the base version unchanged.
    for (const im of (await imagesOf(v.base_version_id)).filter((c) => !v.views.includes(c.view) && c.view !== "portfolio" && !have.has(c.view))) {
      await q("INSERT INTO visual_images (version_id, view, file_sha, prompt) VALUES ($1,$2,$3,$4)", [versionId, im.view, im.file_sha, im.prompt]);
    }
    // Every missing view at once; the image layer limits how many run together.
    const todo = v.views.map((name) => VIEWS[item.category].find((x) => x.view === name)).filter((x): x is View => !!x && !x.derived && !have.has(x.view));
    const results = await Promise.allSettled(todo.map(async (view) => {
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
      await q("INSERT INTO visual_images (version_id, view, file_sha, prompt) VALUES ($1,$2,$3,$4)", [versionId, view.view, sha, prompt]);
      if (out.cents) await q("INSERT INTO spend (project_id, category, provider, model, cents, ref_id) VALUES ($1,'image',$2,$3,$4,$5)", [item.project_id, out.provider, out.model, out.cents, versionId]);
      await q("UPDATE visual_versions SET provider=$2, model=$3, cost_cents=cost_cents+$4 WHERE id=$1", [versionId, out.provider, out.model, out.cents]);
    }));
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failed.length) throw new Error(`${failed.length} of ${todo.length} image(s) failed: ${String(failed[0].reason?.message ?? failed[0].reason).slice(0, 400)}. Try again makes only the missing ones.`);
    if (item.category === "character") await composePortfolio(versionId);
    await q("UPDATE visual_versions SET status='ready', reference_shas=$2 WHERE id=$1", [versionId, refs.map((r) => r.sha)]);
    await q("UPDATE visual_items SET status=CASE WHEN status='generating' THEN 'review' ELSE status END, updated_at=now() WHERE id=$1", [item.id]);
    // Children that were waiting for this version can start now, using its images.
    const waiting = await q<{ id: string }>("SELECT id FROM visual_versions WHERE wait_for_version_id=$1 AND status='waiting'", [versionId]);
    for (const w of waiting) await queueVersion(w.id).catch(async (e) => q("UPDATE visual_versions SET status='failed', error=$2 WHERE id=$1", [w.id, (e as Error).message]));
  } catch (e) {
    await q("UPDATE visual_versions SET status='failed', error=$2 WHERE id=$1", [versionId, String((e as Error).message).slice(0, 1000)]);
    await q("UPDATE visual_items SET status=CASE WHEN approved_version_id IS NULL THEN 'todo' ELSE 'approved' END, updated_at=now() WHERE id=$1", [item.id]);
    // Children waiting on this version cannot use it.
    await q("UPDATE visual_versions SET status='failed', error='Its parent look failed; try that first.' WHERE wait_for_version_id=$1 AND status='waiting'", [versionId]);
    throw Object.assign(e as Error, { retryable: false });
  }
}

// ---------- Approve, upload, change ----------

export async function approveVersion(versionId: string) {
  const v = await one<Version>("SELECT * FROM visual_versions WHERE id=$1", [versionId]);
  if (!v || v.status !== "ready") throw new Error("Only a finished version can be approved.");
  const item = (await one<Item>("SELECT * FROM visual_items WHERE id=$1", [v.item_id]))!;
  const changed = item.approved_version_id && item.approved_version_id !== versionId;
  await q(
    `UPDATE visual_items SET approved_version_id=$2, status='approved', flag_reason=NULL, updated_at=now(),
       base_prompt=CASE WHEN $3 THEN $4 ELSE base_prompt END, description=COALESCE($5, description) WHERE id=$1`,
    [item.id, versionId, v.provider !== "upload", v.prompt, v.new_description]);
  let flagged: string[] = [];
  if (changed && !v.change_set_id) {
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

/** The item and everything built from it: later ages, outfits, and their own children. */
export async function familyOf(item: Item): Promise<Item[]> {
  const all = await q<Item>("SELECT * FROM visual_items WHERE project_id=$1 ORDER BY sort", [item.project_id]);
  const out: Item[] = [];
  const walk = (key: string) => {
    for (const child of all.filter((i) => i.parent_key === key)) {
      if (out.some((o) => o.id === child.id)) continue;
      out.push(child);
      walk(child.key);
    }
  };
  walk(item.key);
  return out;
}

async function latestVersion(itemId: string) {
  return one<Version>("SELECT * FROM visual_versions WHERE item_id=$1 AND provider IS DISTINCT FROM 'upload' ORDER BY (status='ready') DESC, n DESC LIMIT 1", [itemId]);
}

const CHANGE_SCHEMA = {
  type: "object", additionalProperties: false, required: ["understood", "item", "family"],
  properties: {
    understood: str,
    item: { type: "object", additionalProperties: false, required: ["prompt", "description", "views", "keep_identity"],
      properties: { prompt: str, description: str, views: { type: "array", items: str }, keep_identity: { type: "boolean" } } },
    family: { type: "array", items: { type: "object", additionalProperties: false, required: ["key", "affected", "understood", "prompt", "description"],
      properties: { key: str, affected: { type: "boolean" }, understood: str, prompt: str, description: str } } },
  },
};

const CHANGE_SYSTEM = `# visual_change v2 (2026-11-26)

A reviewer asks for a change to one reference item of a microdrama, in plain words. The change must carry through to every item built from it: the same person at later ages, the outfits they wear, and so on.

Return:
- understood: one or two short sentences to the reviewer saying what will change, what stays the same, and which related items will be updated.
- item: the revised prompt (the full subject description, keeping every detail the request does not change), a revised 1–3 sentence description, which of the listed views must be regenerated, and keep_identity (true unless the reviewer asks for a different face or object).
- family: for EVERY related item listed, whether the change affects it, a one-line note of what changes there, and its full revised prompt and description. Carry identity changes (face, build, hair, skin, profession or wardrobe style) to later ages with sensible aging; carry wardrobe changes to the outfits; leave items alone when the change does not concern them (affected=false, prompt and description unchanged).
If the request would make a child's depiction revealing or unsafe, keep the original clothing and say so in understood.`;

/**
 * Plain-words change → one change set: a draft for the item and a draft for every
 * related item the change affects. Related items never generated just get the
 * updated prompt (free). Children wait for their parent's new version and use its images.
 */
export async function interpretChange(item: Item, baseVersionId: string, request: string) {
  const base = await one<Version>("SELECT * FROM visual_versions WHERE id=$1", [baseVersionId]);
  if (!base) throw new Error("version not found");
  const family = await familyOf(item);
  const famPrompts = await Promise.all(family.map(async (f) => ({ f, latest: await latestVersion(f.id) })));
  const res = await runStructured<{
    understood: string;
    item: { prompt: string; description: string; views: string[]; keep_identity: boolean };
    family: { key: string; affected: boolean; understood: string; prompt: string; description: string }[];
  }>({
    role: "visual_change",
    model: "claude-sonnet-5-5",
    projectId: item.project_id,
    system: CHANGE_SYSTEM,
    input: JSON.stringify({
      item: { key: item.key, category: item.category, name: item.name, description: item.description, protected: item.protected, current_prompt: base.prompt },
      views: VIEWS[item.category].filter((v) => !v.derived).map((v) => ({ view: v.view, shows: v.label })),
      related: famPrompts.map(({ f, latest }) => ({
        key: f.key, category: f.category, name: f.name, parent_key: f.parent_key, description: f.description, current_prompt: latest?.prompt ?? f.base_prompt,
      })),
      request,
    }),
    schema: CHANGE_SCHEMA,
  });
  const setId = crypto.randomUUID();
  const own = VIEWS[item.category].filter((v) => !v.derived);
  const valid = res.data.item.views.filter((x) => own.some((v) => v.view === x));
  const mainId = await createDraft(item, {
    prompt: res.data.item.prompt, views: valid.length ? valid : own.map((v) => v.view), base: base.provider === "upload" ? null : baseVersionId,
    change: request, understood: res.data.understood, keepIdentity: res.data.item.keep_identity,
    changeSetId: setId, newDescription: res.data.item.description,
  });
  // Children in family order: each waits for its parent's draft in this set, if there is one.
  const draftOf = new Map<string, string>([[item.key, mainId]]);
  for (const f of family) {
    const plan = res.data.family.find((x) => x.key === f.key);
    if (!plan?.affected) continue;
    const latest = famPrompts.find((x) => x.f.id === f.id)?.latest;
    if (!latest) {
      // Never generated: just update what it will be made from.
      await q("UPDATE visual_items SET base_prompt=$2, description=$3, updated_at=now() WHERE id=$1", [f.id, plan.prompt, plan.description]);
      continue;
    }
    const waitFor = f.parent_key ? draftOf.get(f.parent_key) ?? null : null;
    const id = await createDraft(f, {
      prompt: plan.prompt, base: latest.id, change: request, understood: plan.understood, keepIdentity: true,
      changeSetId: setId, waitFor, newDescription: plan.description,
    });
    draftOf.set(f.key, id);
  }
  return mainId;
}

/** Queue every draft in a change set; children wait for their parent's new version. */
export async function queueChangeSet(changeSetId: string) {
  const drafts = await q<{ id: string }>("SELECT id FROM visual_versions WHERE change_set_id=$1 AND status IN ('draft','failed') ORDER BY created_at", [changeSetId]);
  for (const d of drafts) await queueVersion(d.id);
  return drafts.length;
}

/** Approve every finished version in a change set in one go. */
export async function approveChangeSet(changeSetId: string) {
  const ready = await q<{ id: string }>("SELECT id FROM visual_versions WHERE change_set_id=$1 AND status='ready' ORDER BY created_at", [changeSetId]);
  for (const r of ready) await approveVersion(r.id);
  return ready.length;
}

export async function discardChangeSet(changeSetId: string) {
  await q("DELETE FROM visual_versions WHERE change_set_id=$1 AND status='draft'", [changeSetId]);
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


/**
 * Join front, back and face into one portfolio sheet on white, like a casting
 * sheet. Free: done locally with FFmpeg. Skipped for placeholder (SVG) images.
 */
export async function composePortfolio(versionId: string) {
  const ims = await imagesOf(versionId, ["full_front", "full_back", "face"]);
  const order = ["full_front", "full_back", "face"].map((v) => ims.find((i) => i.view === v)).filter(Boolean) as { file_sha: string; prompt: string }[];
  if (order.length < 3) return;
  const files = await Promise.all(order.map((i) => readStored(i.file_sha)));
  if (files.some((f) => f.mime === "image/svg+xml")) return;
  const { mkdtemp, writeFile, readFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const { execFile } = await import("node:child_process");
  const dir = await mkdtemp(path.join(tmpdir(), "portfolio-"));
  try {
    const inputs = await Promise.all(files.map(async (f, i) => { const p = path.join(dir, `${i}.img`); await writeFile(p, f.buf); return p; }));
    const out = path.join(dir, "portfolio.jpg");
    const H = 1536, GAP = 24;
    const filter = [0, 1, 2].map((i) => `[${i}:v]scale=-2:${H},pad=iw+${i < 2 ? GAP : 0}:ih:0:0:white[v${i}]`).join(";") + ";[v0][v1][v2]hstack=inputs=3[out]";
    await new Promise<void>((res, rej) => execFile("ffmpeg", ["-v", "error", "-y", ...inputs.flatMap((p) => ["-i", p]), "-filter_complex", filter, "-map", "[out]", "-q:v", "2", out],
      (err) => (err ? rej(err) : res())));
    const sha = await storeFile(await readFile(out), "image/jpeg", "derived");
    await q("DELETE FROM visual_images WHERE version_id=$1 AND view='portfolio'", [versionId]);
    await q("INSERT INTO visual_images (version_id, view, file_sha, prompt) VALUES ($1,'portfolio',$2,'Front, back and face joined into one sheet')", [versionId, sha]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
