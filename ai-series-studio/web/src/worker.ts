/** Background worker: runs queued jobs from Postgres. Start with `npm run worker`. */
import { migrate } from "./lib/db";
import { claim, complete, fail, type Job } from "./lib/jobs";
import { runIntake } from "./lib/intake";

const handlers: Record<string, (job: Job) => Promise<void>> = {
  "intake.extract": async (job) => runIntake(job.project_id!),
};

let stopping = false;
process.on("SIGINT", () => (stopping = true));
process.on("SIGTERM", () => (stopping = true));

async function main() {
  await migrate();
  console.log("worker ready");
  while (!stopping) {
    const job = await claim();
    if (!job) {
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }
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
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
