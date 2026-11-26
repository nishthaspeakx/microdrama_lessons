/**
 * Save a hand-checked intake result for one project's exact input, so the flow
 * can be tested without an API key. Usage:
 *   npx tsx scripts/record-intake.ts <projectId> <intake.json>
 * The replay only matches the same files, typed brief and prompt version.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { buildIntakeInput } from "../src/lib/intake";
import { INTAKE_SYSTEM, intakeSchema } from "../src/lib/intakeSchema";
import { sha256 } from "../src/lib/storage";
import { pool } from "../src/lib/db";

async function main() {
  const [projectId, dataFile] = process.argv.slice(2);
  const { input, refs } = await buildIntakeInput(projectId);
  const hash = sha256(`intake\n${INTAKE_SYSTEM}\n${input}`);
  const data = JSON.parse(readFileSync(dataFile, "utf8"));
  // Same shape the API would be forced into: every required key present.
  const required = (intakeSchema as { required: string[] }).required;
  const missingKeys = required.filter((k) => !(k in data));
  const cited = JSON.stringify(data).match(/"d\d+:s\d+"/g)?.map((x) => x.slice(1, -1)) ?? [];
  const unknown = [...new Set(cited.filter((r) => !refs.has(r)))];
  const dir = path.join(process.cwd(), "fixtures", "llm");
  mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `intake-${hash.slice(0, 16)}.json`);
  writeFileSync(out, JSON.stringify({ role: "intake", inputHash: hash, model: "recorded (hand-checked in a Claude Code session)", data }, null, 1));
  console.log(path.basename(out), "| sections in input:", refs.size, "| missing keys:", missingKeys, "| unknown refs:", unknown);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
