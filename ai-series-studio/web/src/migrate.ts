import { migrate, pool } from "./lib/db";
migrate().then(() => pool.end()).catch((e) => { console.error(e); process.exit(1); });
