/** Count the voices on the account by category (free). Usage: npx tsx scripts/voice-slots.ts */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const h = { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "" };
  const sub = await (await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: h })).json();
  const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: h });
  const j = (await r.json()) as { voices?: { category: string }[] };
  const counts: Record<string, number> = {};
  for (const v of j.voices ?? []) counts[v.category] = (counts[v.category] ?? 0) + 1;
  console.log("subscription says:", sub.voice_slots_used, "of", sub.voice_limit, "| professional:", sub.professional_voice_slots_used ?? "?", "of", sub.professional_voice_limit ?? "?");
  console.log("voices listed by category:", counts);
}
main();

/** With --list: the slot-using voices, oldest first. */
if (process.argv.includes("--list")) {
  (async () => {
    const h = { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "" };
    const j = (await (await fetch("https://api.elevenlabs.io/v1/voices", { headers: h })).json()) as
      { voices: { name: string; category: string; created_at_unix?: number }[] };
    const mine = j.voices.filter((v) => v.category === "cloned" || v.category === "generated")
      .sort((a, b) => (a.created_at_unix ?? 0) - (b.created_at_unix ?? 0));
    mine.forEach((v, i) => console.log(`${String(i + 1).padStart(2)}. ${v.name} · ${v.category} · ${v.created_at_unix ? new Date(v.created_at_unix * 1000).toISOString().slice(0, 10) : "date unknown"}`));
  })();
}
