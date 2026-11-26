import { readStored } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Serve a stored file. Content-addressed, so it can be cached forever.
 * Answers Range requests, so video can be scrubbed. ?download=name.mp4 saves it under that name.
 */
export async function GET(req: Request, { params }: { params: Promise<{ sha: string }> }) {
  const { sha } = await params;
  if (!/^[0-9a-f]{64}$/.test(sha)) return new Response("not found", { status: 404 });
  let f: { buf: Buffer; mime: string };
  try {
    f = await readStored(sha);
  } catch {
    return new Response("not found", { status: 404 });
  }
  const headers: Record<string, string> = {
    "Content-Type": f.mime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes",
  };
  const name = new URL(req.url).searchParams.get("download");
  if (name) headers["Content-Disposition"] = `attachment; filename="${name.replace(/[^\w.\- ]/g, "_")}"`;
  const size = f.buf.length;
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : size - 1;
    start = Math.max(0, start); end = Math.min(size - 1, end);
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    return new Response(new Uint8Array(f.buf.subarray(start, end + 1)), {
      status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(new Uint8Array(f.buf), { headers: { ...headers, "Content-Length": String(size) } });
}
