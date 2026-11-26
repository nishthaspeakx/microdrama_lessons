/* Load .env.local the same way Next.js does, so the worker sees the same keys. */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { migrate, pool } from "./lib/db";
migrate().then(() => pool.end()).catch((e) => { console.error(e); process.exit(1); });
