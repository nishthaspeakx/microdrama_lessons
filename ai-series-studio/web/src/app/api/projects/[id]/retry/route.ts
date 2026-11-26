import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { enqueue } from "@/lib/jobs";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await q("UPDATE projects SET status='extracting', updated_at=now() WHERE id=$1 RETURNING id", [id]);
  if (!r.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  await enqueue("intake.extract", id);
  return NextResponse.json({ ok: true });
}
