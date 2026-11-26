/**
 * Gemini Nano Banana 2.1 through the Interactions API (docs read 2026-11-26):
 * POST /v1beta/interactions with {model, input: [text and image parts],
 * response_format: {type: "image", aspect_ratio, image_size}}. Image bytes come
 * back as base64 in steps[].content[] blocks of type "image". One image per call.
 */
import { GEMINI_MODEL, MAX_REFS, type GenRequest, type GenResult } from "./index";

const URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

export async function generate(req: GenRequest): Promise<GenResult> {
  const chars = req.refs.filter((r) => r.role === "character").slice(0, MAX_REFS.character);
  const objs = req.refs.filter((r) => r.role === "object").slice(0, MAX_REFS.object);
  const input = [
    { type: "text", text: req.prompt },
    ...[...chars, ...objs].map((r) => ({ type: "image", mime_type: r.mime, data: r.data.toString("base64") })),
  ];
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY!, "Api-Revision": "2026-05-20" },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      input,
      response_format: { type: "image", aspect_ratio: req.aspect, image_size: req.size, mime_type: "image/png" },
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${text.slice(0, 400)}`);
  const json = JSON.parse(text);
  let data: string | undefined;
  for (const step of json.steps ?? []) {
    if (step.type !== "model_output") continue;
    for (const block of step.content ?? []) if (block.type === "image" && block.data) data ??= block.data;
  }
  data ??= json.output_image?.data;
  if (!data) {
    const said = (json.steps ?? []).flatMap((s: { content?: { type: string; text?: string }[] }) => s.content ?? [])
      .filter((b: { type: string }) => b.type === "text").map((b: { text?: string }) => b.text).join(" ");
    throw new Error(`Gemini returned no image${said ? `: ${said.slice(0, 300)}` : ""}`);
  }
  const cents = ({ "1K": 3.36, "2K": 5.04, "4K": 11.3 } as Record<string, number>)[req.size] ?? 5.04;
  return { buf: Buffer.from(data, "base64"), mime: "image/png", provider: "gemini", model: GEMINI_MODEL, cents };
}
