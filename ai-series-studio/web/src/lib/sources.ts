/**
 * Source files → text → numbered sections.
 *
 * Every section gets a stable reference like `d1:s12`. The extraction cites
 * these references, which is how every extracted fact links back to the
 * exact text it came from.
 */
export type Section = {
  ref: string;
  level: number;
  heading: string;
  path: string[];
  startLine: number;
  endLine: number;
  text: string;
};

export const ACCEPTED = [".md", ".markdown", ".txt", ".pdf"];
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i).toLowerCase();
}

export async function fileToText(name: string, buf: Buffer): Promise<string> {
  const ext = extOf(name);
  if (ext === ".pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: false });
    // Mark pages so PDF sections can cite them.
    return (text as string[]).map((t, i) => `\f[Page ${i + 1}]\n${t.trim()}`).join("\n\n");
  }
  if (ext === ".md" || ext === ".markdown" || ext === ".txt") return buf.toString("utf8").replace(/\r\n?/g, "\n");
  throw new Error(`Unsupported file type ${ext || "(none)"}. Use Markdown, PDF or plain text.`);
}

const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

/** Markdown: one section per heading. PDF: one per page. Text: blocks of up to 60 lines. */
export function sectionize(docIdx: number, name: string, text: string): Section[] {
  const lines = text.split("\n");
  const out: Section[] = [];
  const push = (level: number, heading: string, path: string[], start: number, end: number) => {
    const body = lines.slice(start - 1, end).join("\n").trim();
    if (!body) return;
    out.push({ ref: `d${docIdx}:s${out.length + 1}`, level, heading, path, startLine: start, endLine: end, text: body });
  };
  const ext = extOf(name);

  if (ext === ".pdf") {
    let start = 1, page = 0;
    lines.forEach((l, i) => {
      const m = l.match(/^\f?\[Page (\d+)\]$/);
      if (m) {
        if (page) push(1, `Page ${page}`, [], start, i);
        page = Number(m[1]);
        start = i + 2; // the line after the page marker (lines are 1-based)
      }
    });
    if (page) push(1, `Page ${page}`, [], start, lines.length);
    return out;
  }

  const isMd = ext !== ".txt" || lines.some((l) => HEADING.test(l));
  if (isMd) {
    const stack: { level: number; heading: string }[] = [];
    let cur = { level: 0, heading: "Opening text", start: 1, path: [] as string[] };
    lines.forEach((l, i) => {
      const m = l.match(HEADING);
      if (!m) return;
      push(cur.level, cur.heading, cur.path, cur.start, i);
      const level = m[1].length;
      const heading = m[2].replace(/\*\*/g, "").trim();
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      const path = stack.map((s) => s.heading);
      stack.push({ level, heading });
      cur = { level, heading, start: i + 1, path };
    });
    push(cur.level, cur.heading, cur.path, cur.start, lines.length);
    return out;
  }

  for (let s = 1; s <= lines.length; s += 60) push(1, `Lines ${s}–${Math.min(s + 59, lines.length)}`, [], s, Math.min(s + 59, lines.length));
  return out;
}

/** The text the model reads: every section with its reference and line range. */
export function renderForModel(docs: { idx: number; filename: string; kind: string; sections: Section[] }[]) {
  return docs
    .map((d) => {
      const head = `=== Document d${d.idx}: ${d.filename} (${d.kind === "typed_brief" ? "typed by the user" : "uploaded file"}) ===`;
      const body = d.sections
        .map((s) => `[${s.ref}] ${[...s.path, s.heading].join(" › ")} (lines ${s.startLine}–${s.endLine})\n${s.text}`)
        .join("\n\n");
      return `${head}\n${body}`;
    })
    .join("\n\n");
}
