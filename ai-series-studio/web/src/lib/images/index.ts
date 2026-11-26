/**
 * Image generation behind one small interface, so models can be swapped.
 * IMAGE_PROVIDER chooses explicitly (openai | gemini | mock). Otherwise:
 * OPENAI_API_KEY → OpenAI GPT Image; else GEMINI_API_KEY → Gemini Nano Banana 2.1.
 * mock → labelled placeholder images for testing the flow without spending.
 */
export type RefImage = { mime: string; data: Buffer; role: "character" | "object" };
export type GenRequest = { prompt: string; refs: RefImage[]; aspect: string; size: "1K" | "2K" | "4K" };
export type GenResult = { buf: Buffer; mime: string; provider: string; model: string; cents: number };

export class NoImageProvider extends Error {}

export const GEMINI_MODEL = "gemini-nano-banana-2.1";
// Nano Banana 2.1 takes up to 4 character and 10 object reference images.
export const MAX_REFS = { character: 4, object: 10 };

type Provider = { name: "openai" | "gemini" | "mock" | "none"; label: string; model: string; centsPerImage: (size: string) => number };

export function imageProvider(): Provider {
  const pick = process.env.IMAGE_PROVIDER?.trim();
  const openai = (): Provider => ({
    name: "openai", label: "OpenAI", model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.6-sunburst",
    // OpenAI bills by tokens; this is only the estimate shown before generating. Actual cost is recorded per image.
    centsPerImage: () => Number(process.env.OPENAI_EST_CENTS_PER_IMAGE ?? 8),
  });
  const gemini = (): Provider => ({
    name: "gemini", label: "Gemini", model: GEMINI_MODEL, centsPerImage: (size) => ({ "1K": 3.36, "2K": 5.04, "4K": 11.3 })[size] ?? 5.04,
  });
  if (pick === "mock") return { name: "mock", label: "Placeholder images (test mode)", model: "placeholder", centsPerImage: () => 0 };
  if (pick === "openai" && process.env.OPENAI_API_KEY) return openai();
  if (pick === "gemini" && process.env.GEMINI_API_KEY) return gemini();
  if (!pick && process.env.OPENAI_API_KEY) return openai();
  if (!pick && process.env.GEMINI_API_KEY) return gemini();
  return { name: "none", label: "", model: "", centsPerImage: () => 0 };
}

// At most IMAGE_CONCURRENCY image calls at once across the whole worker, so many
// views can run in parallel without tripping the provider's rate limits.
const LIMIT = Number(process.env.IMAGE_CONCURRENCY ?? 8);
let active = 0;
const waiting: (() => void)[] = [];
async function acquire() {
  if (active < LIMIT) { active++; return; }
  await new Promise<void>((r) => waiting.push(r));
  active++;
}
function release() {
  active--;
  waiting.shift()?.();
}

async function callProvider(req: GenRequest): Promise<GenResult> {
  const p = imageProvider();
  if (p.name === "mock") return (await import("./mock")).generate(req);
  if (p.name === "openai") return (await import("./openai")).generate(req);
  if (p.name === "gemini") return (await import("./gemini")).generate(req);
  throw new NoImageProvider("Image generation needs OPENAI_API_KEY (or GEMINI_API_KEY) in web/.env.local.");
}

/** One image, with a concurrency slot and backoff on rate limits or provider hiccups (never on safety blocks). */
export async function generateImage(req: GenRequest): Promise<GenResult> {
  await acquire();
  try {
    for (let attempt = 1; ; attempt++) {
      try {
        return await callProvider(req);
      } catch (e) {
        const msg = (e as Error).message;
        const transient = /\b(429|500|502|503|504)\b|rate limit|timeout|ECONNRESET|fetch failed/i.test(msg) && !/credits remaining|safety filter|moderation/i.test(msg);
        if (!transient || attempt >= 3) throw e;
        await new Promise((r) => setTimeout(r, 10000 * attempt));
      }
    }
  } finally {
    release();
  }
}
