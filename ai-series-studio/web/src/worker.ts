/* Load .env.local the same way Next.js does, so the worker sees the same keys. */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
/** Background worker: runs queued jobs from Postgres, several at a time. Start with `npm run worker`. */
import { migrate } from "./lib/db";
import { claim, complete, fail, type Job } from "./lib/jobs";
import { runIntake } from "./lib/intake";
import { planVisuals, runGeneration } from "./lib/visuals";

const handlers: Record<string, (job: Job) => Promise<void>> = {
  "intake.extract": async (job) => runIntake(job.project_id!),
  "visuals.plan": async (job) => planVisuals(job.project_id!),
  "visuals.generate": async (job) => runGeneration(String(job.payload.versionId)),
};

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 4);
let stopping = false;
process.on("SIGINT", () => (stopping = true));
process.on("SIGTERM", () => (stopping = true));

async function run(job: Job) {
  const handler = handlers[job.type];
  try {
    if (!handler) throw Object.assign(new Error(`no handler for ${job.type}`), { retryable: false });
    console.log(`run ${job.type} ${job.id}`);
    await handler(job);
    await complete(job.id);
    console.log(`done ${job.type} ${job.id}`);
  } catch (e) {
    const retryable = (e as { retryable?: boolean }).retryable !== false;
    const again = await fail(job, e, retryable);
    console.error(`fail ${job.type} ${job.id}: ${(e as Error).message}${again ? " (will retry)" : ""}`);
  }
}

async function main() {
  await migrate();
  console.log(`worker ready (${CONCURRENCY} at a time)`);
  const running = new Set<Promise<void>>();
  while (!stopping) {
    if (running.size >= CONCURRENCY) {
      await Promise.race(running);
      continue;
    }
    const job = await claim();
    if (!job) {
      await new Promise((r) => setTimeout(r, 700));
      continue;
    }
    const p = run(job).finally(() => running.delete(p));
    running.add(p);
  }
  await Promise.all(running);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
