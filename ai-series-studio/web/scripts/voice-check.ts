/**
 * Free check of the ElevenLabs key: look up one voice and read the plan.
 * Usage: npx tsx scripts/voice-check.ts [voiceId]
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { getVoice, voiceProvider } from "../src/lib/voice/provider";

async function main() {
  const id = process.argv[2] ?? "RABOvaPec1ymXz02oDQi";
  console.log("provider:", voiceProvider());
  try {
    const v = await getVoice(id);
    console.log("voice lookup ok:", v.name, "|", v.category);
  } catch (e) {
    console.log("voice lookup failed:", (e as Error).message);
  }
  const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "" } });
  if (r.ok) {
    const s = await r.json();
    console.log("plan:", s.tier, "| characters used:", s.character_count, "of", s.character_limit, "| voices:", s.voice_slots_used ?? "?", "of", s.voice_limit ?? "?");
  } else {
    console.log("plan check:", r.status, (await r.text()).slice(0, 200));
  }
}
main();
