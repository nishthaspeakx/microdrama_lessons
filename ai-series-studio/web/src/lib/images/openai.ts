/**
 * OpenAI GPT Image through the Image API (docs read 2026-11-26).
 * - No references: POST /v1/images/generations (JSON).
 * - With references: POST /v1/images/edits (JSON) with "images": [{image_url: data URL}], up to 16.
 * - Custom sizes must have both sides divisible by 16, aspect between 1:3 and 3:1.
 * - Responses carry b64_json and token usage; cost = tokens at the published rates.
 * - Your organisation may need API Organization Verification before GPT Image models work.
 */
import { createHash } from "node:crypto";
import type { GenRequest, GenResult } from "./index";

export const OPENAI_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.6-sunburst";
const QUALITY = process.env.OPENAI_IMAGE_QUALITY || "medium";
const MAX_REFS = 16;

// Exact ratios, both sides divisible by 16, under the 2560x1440 "experimental" pixel count.
const SIZES: Record<string, string> = { "9:16": "1152x2048", "16:9": "2048x1152", "3:4": "1152x1536", "1:1": "1024x1024" };

// Published per-1M-token prices for gpt-image-2.x (standard tier).
const PRICE = { imageIn: 8, textIn: 5, imageOut: 30 };

type Usage = {
  input_tokens?: number; output_tokens?: number;
  input_tokens_details?: { image_tokens?: number; text_tokens?: number };
};

export async function generate(req: GenRequest): Promise<GenResult> {
  const refs = req.refs.slice(0, MAX_REFS);
  const body: Record<string, unknown> = {
    model: OPENAI_MODEL,
    prompt: req.prompt,
    size: SIZES[req.aspect] ?? "1024x1024",
    quality: QUALITY,
    n: 1,
    output_format: "png",
    moderation: "auto",
    safety_identifier: createHash("sha256").update("microdrama-studio").digest("hex").slice(0, 32),
  };
  if (refs.length) body.images = refs.map((r) => ({ image_url: `data:${r.mime};base64,${r.data.toString("base64")}` }));
  const res = await fetch(`https://api.openai.com/v1/images/${refs.length ? "edits" : "generations"}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 400);
    try {
      const err = JSON.parse(text).error;
      if (err?.code === "moderation_blocked") msg = "OpenAI's safety filter blocked this image. Rephrase the change; the app does not retry blocked requests automatically.";
      else if (/verif/i.test(err?.message ?? "")) msg = `${err.message} (OpenAI asks some organisations to complete API Organization Verification before using GPT Image models.)`;
      else if (err?.message) msg = err.message;
    } catch {}
    throw new Error(`OpenAI ${res.status}: ${msg}`);
  }
  const json = JSON.parse(text) as { data?: { b64_json?: string }[]; usage?: Usage };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI returned no image.");
  const u = json.usage ?? {};
  const imgIn = u.input_tokens_details?.image_tokens ?? 0;
  const txtIn = u.input_tokens_details?.text_tokens ?? Math.max(0, (u.input_tokens ?? 0) - imgIn);
  const cents = (100 * (imgIn * PRICE.imageIn + txtIn * PRICE.textIn + (u.output_tokens ?? 0) * PRICE.imageOut)) / 1e6;
  return { buf: Buffer.from(b64, "base64"), mime: "image/png", provider: "openai", model: OPENAI_MODEL, cents };
}
