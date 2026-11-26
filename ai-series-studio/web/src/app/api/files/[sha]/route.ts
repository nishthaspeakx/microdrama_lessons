import { readStored } from "@/lib/storage";

export const runtime = "nodejs";

/** Serve a stored file. Content-addressed, so it can be cached forever. */
export async function GET(_req: Request, { params }: { params: Promise<{ sha: string }> }) {
  const { sha } = await params;
  if (!/^[0-9a-f]{64}$/.test(sha)) return new Response("not found", { status: 404 });
  try {
    const f = await readStored(sha);
    return new Response(new Uint8Array(f.buf), {
      headers: { "Content-Type": f.mime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
