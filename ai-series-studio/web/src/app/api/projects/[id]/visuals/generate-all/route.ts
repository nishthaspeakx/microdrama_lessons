import { q, one } from "@/lib/db";
import { guard } from "@/lib/api";
import { createDraft, queueVersion, type Item } from "@/lib/visuals";

export const runtime = "nodejs";

/**
 * Create everything still to do in one go. Parents go first; a child whose
 * parent is not approved waits for the parent's new version and is made from
 * its images. Optional parents that a required item depends on are made too.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guard(async () => {
    if (!(await one("SELECT 1 FROM projects WHERE id=$1", [id]))) throw new Error("This project was not found. Open it again from the home page.");
    const all = await q<Item>("SELECT * FROM visual_items WHERE project_id=$1 ORDER BY sort", [id]);
    const versions = await q<{ id: string; item_id: string; status: string; n: number }>(
      `SELECT v.id, v.item_id, v.status, v.n FROM visual_versions v JOIN visual_items i ON i.id=v.item_id
       WHERE i.project_id=$1 AND v.provider IS DISTINCT FROM 'upload' ORDER BY v.n DESC`, [id]);
    const byKey = new Map(all.map((i) => [i.key, i]));
    const active = (item: Item) => versions.find((v) => v.item_id === item.id && ["queued", "generating", "waiting", "ready"].includes(v.status));
    const hasAny = (item: Item) => item.approved_version_id || active(item);

    // Everything required and untouched, plus untouched ancestors they depend on.
    const want = new Set<string>();
    const addWithAncestors = (item: Item) => {
      if (want.has(item.key)) return;
      want.add(item.key);
      const parent = item.parent_key ? byKey.get(item.parent_key) : undefined;
      if (parent && !hasAny(parent)) addWithAncestors(parent);
    };
    all.filter((i) => i.required && i.status === "todo" && !hasAny(i)).forEach(addWithAncestors);

    // Create drafts parents-first, linking each child to its parent's newest version.
    const newVersion = new Map<string, string>();
    const ordered: Item[] = [];
    const visit = (item: Item) => {
      if (ordered.includes(item)) return;
      const parent = item.parent_key ? byKey.get(item.parent_key) : undefined;
      if (parent && want.has(parent.key)) visit(parent);
      ordered.push(item);
    };
    all.filter((i) => want.has(i.key)).forEach(visit);
    let queued = 0;
    for (const item of ordered) {
      const parent = item.parent_key ? byKey.get(item.parent_key) : undefined;
      let waitFor: string | null = null;
      if (parent && !parent.approved_version_id) waitFor = newVersion.get(parent.key) ?? active(parent)?.id ?? null;
      const draft = await createDraft(item, { waitFor, autoApprove: true });
      newVersion.set(item.key, draft);
      await queueVersion(draft);
      queued++;
    }
    return { queued, waiting: [] as string[] };
  });
}
