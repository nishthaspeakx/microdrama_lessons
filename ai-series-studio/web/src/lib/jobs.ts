import { q, one } from "./db";

export type Job = {
  id: string;
  project_id: string | null;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
};

export async function enqueue(type: string, projectId: string | null, payload: Record<string, unknown> = {}) {
  const row = await one<{ id: string }>(
    "INSERT INTO jobs (type, project_id, payload) VALUES ($1, $2, $3) RETURNING id",
    [type, projectId, JSON.stringify(payload)],
  );
  return row!.id;
}

/** Claim the oldest runnable job. SKIP LOCKED lets several workers run safely. */
export async function claim(): Promise<Job | null> {
  // Requeue jobs whose worker died mid-run.
  await q(
    "UPDATE jobs SET status='queued', locked_at=NULL WHERE status='running' AND locked_at < now() - interval '15 minutes'",
  );
  return one<Job>(
    `UPDATE jobs SET status='running', locked_at=now(), attempts=attempts+1
     WHERE id = (SELECT id FROM jobs WHERE status='queued' AND run_after <= now()
                 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
     RETURNING id, project_id, type, payload, attempts, max_attempts`,
  );
}

export async function complete(id: string) {
  await q("UPDATE jobs SET status='done', finished_at=now(), error=NULL WHERE id=$1", [id]);
}

export async function fail(job: Job, err: unknown, retryable: boolean) {
  const msg = err instanceof Error ? err.message : String(err);
  const again = retryable && job.attempts < job.max_attempts;
  await q(
    `UPDATE jobs SET status=$2, error=$3, locked_at=NULL,
       run_after = now() + ($4 || ' seconds')::interval, finished_at = CASE WHEN $2='failed' THEN now() END
     WHERE id=$1`,
    [job.id, again ? "queued" : "failed", msg.slice(0, 2000), String(30 * job.attempts)],
  );
  return again;
}

/**
 * On worker start: jobs still marked running were cut off by a restart of this
 * worker (one worker per machine in development). Put them back in the queue
 * now instead of waiting 15 minutes. Set WORKER_SHARED=1 when several workers
 * share one database, to leave this to the 15-minute rule.
 */
export async function requeueOrphans() {
  if (process.env.WORKER_SHARED === "1") return 0;
  const r = await q("UPDATE jobs SET status='queued', locked_at=NULL WHERE status='running' RETURNING id");
  return r.length;
}
