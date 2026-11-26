import { NextResponse } from "next/server";
import { q, one } from "@/lib/db";
import { bad, UUID } from "@/lib/api";
import { VIEWS, spentCents } from "@/lib/visuals";
import { imageProvider } from "@/lib/images";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return bad("not found", 404);
  const p = await one<{ visuals_status: string; visual_style: string | null }>("SELECT visuals_status, visual_style FROM projects WHERE id=$1", [id]);
  if (!p) return bad("not found", 404);
  const items = await q("SELECT * FROM visual_items WHERE project_id=$1 ORDER BY sort, name", [id]);
  const versions = await q(
    `SELECT v.id, v.item_id, v.n, v.prompt, v.change_request, v.understood, v.views, v.status, v.error, v.provider, v.model,
            v.est_cents::float AS est_cents, v.cost_cents::float AS cost_cents, v.base_version_id, v.reference_shas, v.created_at
     FROM visual_versions v JOIN visual_items i ON i.id=v.item_id WHERE i.project_id=$1 ORDER BY v.n`, [id]);
  const images = await q(
    `SELECT im.version_id, im.view, im.file_sha FROM visual_images im JOIN visual_versions v ON v.id=im.version_id
     JOIN visual_items i ON i.id=v.item_id WHERE i.project_id=$1`, [id]);
  const job = await one("SELECT status, error FROM jobs WHERE project_id=$1 AND type='visuals.plan' ORDER BY created_at DESC LIMIT 1", [id]);
  const prov = imageProvider();
  return NextResponse.json({
    status: p.visuals_status, style: p.visual_style, items, versions, images, planJob: job,
    views: Object.fromEntries(Object.entries(VIEWS).map(([k, v]) => [k, v.map(({ view, label, aspect }) => ({ view, label, aspect }))])),
    provider: { name: prov.name, model: prov.model, centsPerImage: prov.centsPerImage("2K") },
    spentCents: await spentCents(id),
    budgetCents: Number(process.env.PROJECT_IMAGE_BUDGET_USD ?? 25) * 100,
  });
}
