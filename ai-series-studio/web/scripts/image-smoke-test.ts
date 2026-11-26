/**
 * One real image through the configured provider, with one reference image.
 * Usage: npx tsx scripts/image-smoke-test.ts <reference.jpg> <out.png>
 * Spends one image's worth of credit.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { readFileSync, writeFileSync } from "node:fs";
import { generateImage, imageProvider } from "../src/lib/images";

async function main() {
  const [ref, out] = process.argv.slice(2);
  const p = imageProvider();
  console.log("provider:", p.name, p.model);
  const started = Date.now();
  const res = await generateImage({
    prompt: [
      "Look: Naturalistic, warm cinematic photography of rural central India in 2014, low golden daylight, natural skin tones.",
      "Subject: A boy of about five from a farming village in central India: short, soft black hair, dark eyes, a small slight build, wearing a cream cotton kurta with a buttoned placket.",
      "This image: Head-and-shoulders close-up portrait facing the camera, neutral expression, plain soft background, even daylight. Show the face, hair and distinctive features clearly.",
      "Match the reference image exactly for the face, hair, skin tone, build and any clothing it shows.",
      "This person is a child: fully clothed exactly as described, natural age-appropriate pose and expression, nothing revealing.",
      "Photorealistic. No text, captions, labels or watermarks in the image.",
    ].join("\n\n"),
    refs: [{ mime: "image/jpeg", data: readFileSync(ref), role: "character" }],
    aspect: "3:4",
    size: "2K",
  });
  writeFileSync(out, res.buf);
  console.log(`ok in ${((Date.now() - started) / 1000).toFixed(1)} s · ${res.provider} ${res.model} · ${res.buf.length} bytes · cost ${res.cents.toFixed(2)} cents`);
}
main().catch((e) => { console.error("FAILED:", (e as Error).message); process.exit(1); });
