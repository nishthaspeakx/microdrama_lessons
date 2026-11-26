/** Check which extraction schemas the API will compile (tiny input, cheap model). */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import Anthropic from "@anthropic-ai/sdk";
import { intakeSchema } from "../src/lib/intakeSchema";

const full = intakeSchema as unknown as { properties: Record<string, unknown> };
const pick = (...keys: string[]) => ({
  type: "object", additionalProperties: false, required: keys,
  properties: Object.fromEntries(keys.map((k) => [k, full.properties[k]])),
});
const candidates: Record<string, object> = {
  full: intakeSchema,
  A_series_episodes: pick("series", "episodes"),
  B_cast_world: pick("characters", "locations", "props"),
  C_reqs_conflicts_kinds: pick("production_requirements", "conflicts", "section_kinds", "typed_brief_use"),
};

async function main() {
  const client = new Anthropic();
  for (const [name, schema] of Object.entries(candidates)) {
    try {
      const m = await client.messages.create({
        model: "claude-haiku-5-5", max_tokens: 400,
        messages: [{ role: "user", content: "Series: Test. One episode. Return minimal JSON." }],
        output_config: { format: { type: "json_schema", schema } },
      } as Anthropic.MessageCreateParamsNonStreaming);
      console.log(name, "OK", m.stop_reason, m.usage.input_tokens, m.usage.output_tokens);
    } catch (e) {
      console.log(name, "FAIL", String((e as Error).message).slice(0, 140));
    }
  }
}
main();
