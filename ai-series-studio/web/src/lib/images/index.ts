/**
 * Image generation behind one small interface, so models can be swapped.
 * Provider: GEMINI_API_KEY → Gemini Nano Banana 2.1. IMAGE_PROVIDER=mock →
 * labelled placeholder images for testing the flow without spending.
 */
export type RefImage = { mime: string; data: Buffer; role: "character" | "object" };
export type GenRequest = { prompt: string; refs: RefImage[]; aspect: string; size: "1K" | "2K" | "4K" };
export type GenResult = { buf: Buffer; mime: string; provider: string; model: string; cents: number };

export class NoImageProvider extends Error {}

export function imageProvider(): { name: string; model: string; centsPerImage: (size: string) => number } {
  if (process.env.IMAGE_PROVIDER === "mock") return { name: "mock", model: "placeholder", centsPerImage: () => 0 };
  if (process.env.GEMINI_API_KEY) {
    return { name: "gemini", model: GEMINI_MODEL, centsPerImage: (size) => ({ "1K": 3.36, "2K": 5.04, "4K": 11.3 })[size] ?? 5.04 };
  }
  return { name: "none", model: "", centsPerImage: () => 0 };
}

export const GEMINI_MODEL = "gemini-nano-banana-2.1";
// Nano Banana 2.1 takes up to 4 character and 10 object reference images.
export const MAX_REFS = { character: 4, object: 10 };

export async function generateImage(req: GenRequest): Promise<GenResult> {
  const p = imageProvider();
  if (p.name === "mock") return (await import("./mock")).generate(req);
  if (p.name === "gemini") return (await import("./gemini")).generate(req);
  throw new NoImageProvider("Image generation needs GEMINI_API_KEY in web/.env.local (or IMAGE_PROVIDER=mock to test with placeholders).");
}
