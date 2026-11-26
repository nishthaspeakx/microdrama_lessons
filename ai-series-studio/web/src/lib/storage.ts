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
