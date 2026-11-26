/** Placeholder images for testing the approval flow. Clearly labelled; never used unless IMAGE_PROVIDER=mock. */
import type { GenRequest, GenResult } from "./index";
import { createHash } from "node:crypto";

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

export async function generate(req: GenRequest): Promise<GenResult> {
  const [w, h] = req.aspect === "9:16" ? [540, 960] : req.aspect === "16:9" ? [960, 540] : req.aspect === "3:4" ? [600, 800] : [720, 720];
  const hue = parseInt(createHash("md5").update(req.prompt).digest("hex").slice(0, 2), 16) * 1.4;
  const words = req.prompt.replace(/\s+/g, " ").split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const wd of words) {
    if ((cur + " " + wd).length > Math.floor(w / 11)) { lines.push(cur); cur = wd; } else cur = cur ? `${cur} ${wd}` : wd;
    if (lines.length > 14) break;
  }
  if (cur && lines.length <= 14) lines.push(cur);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="100%" height="100%" fill="hsl(${hue},35%,82%)"/>
<text x="24" y="44" font-family="sans-serif" font-size="22" font-weight="700" fill="#1c1917">PLACEHOLDER · ${req.aspect} · ${req.refs.length} ref(s)</text>
${lines.map((l, i) => `<text x="24" y="${90 + i * 24}" font-family="sans-serif" font-size="16" fill="#292524">${esc(l)}</text>`).join("\n")}
</svg>`;
  await new Promise((r) => setTimeout(r, 400));
  return { buf: Buffer.from(svg), mime: "image/svg+xml", provider: "mock", model: "placeholder", cents: 0 };
}
