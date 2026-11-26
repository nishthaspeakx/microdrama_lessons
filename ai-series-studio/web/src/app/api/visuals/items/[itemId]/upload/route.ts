import { one } from "@/lib/db";
import { bad, guard, UUID } from "@/lib/api";
import { addUpload, type Item } from "@/lib/visuals";

export const runtime = "nodejs";
const OK = ["image/png", "image/jpeg", "image/webp"];

/** Use an existing image (for example an Episode 1 still) as a version and a reference. */
export async function POST(req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  if (!UUID.test(itemId)) return bad("not found", 404);
  const form = await req.formData();
  const f = form.get("file");
  if (!(f instanceof File) || !f.size) return bad("Choose an image.");
  if (!OK.includes(f.type)) return bad("Use a PNG, JPEG or WebP image.");
  if (f.size > 15 * 1024 * 1024) return bad("The image is larger than 15 MB.");
  return guard(async () => {
    const item = await one<Item>("SELECT * FROM visual_items WHERE id=$1", [itemId]);
    if (!item) throw new Error("not found");
    return { versionId: await addUpload(item, Buffer.from(await f.arrayBuffer()), f.type) };
  });
}
