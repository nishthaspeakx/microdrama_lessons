import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const globalForPool = globalThis as unknown as { __pool?: Pool };

export const pool =
  globalForPool.__pool ??
  new Pool({ connectionString: process.env.DATABASE_URL ?? "postgres://localhost/microdrama_studio", max: 8 });
if (process.env.NODE_ENV !== "production") globalForPool.__pool = pool;

export async function q<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool.query<T>(text, params);
  return r.rows;
}

export async function one<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

export async function logEvent(projectId: string | null, kind: string, data: unknown = {}) {
  await q("INSERT INTO events (project_id, kind, data) VALUES ($1, $2, $3)", [projectId, kind, JSON.stringify(data)]);
}

/** Apply db/migrations/*.sql in order, once each. */
export async function migrate() {
  await q("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const dir = path.join(process.cwd(), "db", "migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const done = new Set((await q<{ name: string }>("SELECT name FROM schema_migrations")).map((r) => r.name));
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = await readFile(path.join(dir, f), "utf8");
    await tx(async (c) => {
      await c.query(sql);
      await c.query("INSERT INTO schema_migrations (name) VALUES ($1)", [f]);
    });
    console.log(`migrated ${f}`);
  }
}
