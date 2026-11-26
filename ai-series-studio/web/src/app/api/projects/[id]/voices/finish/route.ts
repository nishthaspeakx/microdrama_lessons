import { guard } from "@/lib/api";
import { finishVoices } from "@/lib/voices";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guard(() => finishVoices(id));
}
