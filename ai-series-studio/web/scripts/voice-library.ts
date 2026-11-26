/**
 * Search the ElevenLabs voice library (free).
 * Usage: npx tsx scripts/voice-library.ts "<gender>" "<age>" [search words]
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const [gender, age, ...words] = process.argv.slice(2);
  const params = new URLSearchParams({ page_size: "40", language: "hi" });
  if (gender) params.set("gender", gender);
  if (age) params.set("age", age);
  if (words.length) params.set("search", words.join(" "));
  const r = await fetch(`https://api.elevenlabs.io/v1/shared-voices?${params}`, { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "" } });
  if (!r.ok) { console.log(r.status, (await r.text()).slice(0, 300)); return; }
  const j = (await r.json()) as { voices: Record<string, unknown>[] };
  for (const v of j.voices) {
    console.log([v.voice_id, v.public_owner_id, v.name, v.gender, v.age, v.accent, v.descriptive, v.use_case, v.cloned_by_count, v.usage_character_count_1y]
      .map((x) => String(x ?? "").replace(/\s+/g, " ").slice(0, 40)).join(" | "));
  }
}
main();
