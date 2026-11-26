import Anthropic from "@anthropic-ai/sdk";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { sha256 } from "./storage";
import { q } from "./db";

export class NoModelAvailable extends Error {}

export type StructuredResult<T> = { data: T; backend: "api" | "recorded"; model: string | null; inputHash: string };

const FIXTURES = path.join(process.cwd(), "fixtures", "llm");

/**
 * One structured Claude call. With ANTHROPIC_API_KEY it calls the Messages API
 * with a JSON schema. Without a key it replays a recorded response for exactly
 * the same role, prompt and input, so the flow can be tested; anything else
 * fails with a clear message. Set RECORD_FIXTURES=1 to save live responses.
 */
export async function runStructured<T>(opts: {
  role: string;
  system: string;
  input: string;
  schema: object;
  model?: string;
  projectId?: string | null;
}): Promise<StructuredResult<T>> {
  const inputHash = sha256(`${opts.role}\n${opts.system}\n${opts.input}`);
  const fixture = path.join(FIXTURES, `${opts.role}-${inputHash.slice(0, 16)}.json`);
  const model = opts.model ?? "claude-opus-5-5";
  const started = Date.now();

  if (process.env.ANTHROPIC_API_KEY) {
    const client = new Anthropic();
    const stream = client.messages.stream({
      model,
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: opts.input }],
      output_config: { format: { type: "json_schema", schema: opts.schema } },
    } as Anthropic.MessageStreamParams);
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") throw new Error(`${opts.role}: the model declined this input; review the sources`);
    if (msg.stop_reason === "max_tokens") throw new Error(`${opts.role}: the answer was cut off; the sources may be too long`);
    const text = msg.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new Error(`${opts.role}: no text in the response`);
    const data = JSON.parse(text.text) as T;
    await q(
      "INSERT INTO llm_calls (project_id, role, backend, model, input_tokens, output_tokens, cache_read_tokens, ms) VALUES ($1,$2,'api',$3,$4,$5,$6,$7)",
      [opts.projectId ?? null, opts.role, model, msg.usage.input_tokens, msg.usage.output_tokens, msg.usage.cache_read_input_tokens ?? 0, Date.now() - started],
    );
    if (process.env.RECORD_FIXTURES === "1") {
      await mkdir(FIXTURES, { recursive: true });
      await writeFile(fixture, JSON.stringify({ role: opts.role, inputHash, model, data }, null, 2));
    }
    return { data, backend: "api", model, inputHash };
  }

  try {
    const rec = JSON.parse(await readFile(fixture, "utf8"));
    if (rec.inputHash !== inputHash) throw new Error("hash mismatch");
    await q("INSERT INTO llm_calls (project_id, role, backend, model, ms) VALUES ($1,$2,'recorded',$3,$4)", [
      opts.projectId ?? null, opts.role, rec.model ?? null, Date.now() - started,
    ]);
    return { data: rec.data as T, backend: "recorded", model: rec.model ?? null, inputHash };
  } catch {
    throw new NoModelAvailable(
      "Reading the sources needs Claude. Add ANTHROPIC_API_KEY to web/.env.local and restart the app. " +
        "(No recorded result exists for these exact files.)",
    );
  }
}
