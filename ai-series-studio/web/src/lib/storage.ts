import { createHash } from "node:crypto";
import { mkdir, rename, writeFile, access } from "node:fs/promises";
import path from "node:path";

/** Content-addressed local storage. S3/R2 replaces this when hosted. */
export const STORAGE_ROOT = process.env.STORAGE_ROOT ?? path.join(process.cwd(), ".data", "storage");

export function sha256(buf: Buffer | string) {
  return createHash("sha256").update(buf).digest("hex");
}

export async function putFile(buf: Buffer, ext: string): Promise<{ key: string; sha: string }> {
  const sha = sha256(buf);
  const key = path.join(sha.slice(0, 2), `${sha}${ext.toLowerCase()}`);
  const dest = path.join(STORAGE_ROOT, key);
  try {
    await access(dest);
    return { key, sha };
  } catch {}
  await mkdir(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.tmp-${process.pid}`;
  await writeFile(tmp, buf);
  await rename(tmp, dest); // never a half-written file
  return { key, sha };
}

/** Store bytes once and register them in the files table. Returns the sha. */
export async function storeFile(buf: Buffer, mime: string, origin: "upload" | "generated" | "derived"): Promise<string> {
  const ext = ({ "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/svg+xml": ".svg" } as Record<string, string>)[mime] ?? "";
  const { key, sha } = await putFile(buf, ext);
  const { q } = await import("./db");
  await q("INSERT INTO files (sha, storage_key, mime, bytes, origin) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (sha) DO NOTHING",
    [sha, key, mime, buf.length, origin]);
  return sha;
}

export async function readStored(sha: string): Promise<{ buf: Buffer; mime: string }> {
  const { one } = await import("./db");
  const row = await one<{ storage_key: string; mime: string }>("SELECT storage_key, mime FROM files WHERE sha=$1", [sha]);
  if (!row) throw new Error(`file ${sha} not found`);
  const { readFile } = await import("node:fs/promises");
  return { buf: await readFile(path.join(STORAGE_ROOT, row.storage_key)), mime: row.mime };
}
