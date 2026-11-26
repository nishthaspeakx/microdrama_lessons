import { guard } from "@/lib/api";
import { finishVisuals } from "@/lib/visuals";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guard(async () => ({ bibleVersion: await finishVisuals(id) }));
}
