// Splits knowledge/nimzo-knowledge-base.md into addressable sections for Arthur's
// and Jev's knowledge harness: app/src/lib/knowledge/sections.json.
// Every line of the document lands in exactly one section (nothing is dropped).
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const src = readFileSync(new URL("../knowledge/nimzo-knowledge-base.md", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const lines = src.split("\n");
const sections = [];
let cur = { id: "intro", title: "Introduction", level: 1, parent: null, band: null, lines: [] };
const stack = []; // [level, id]

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
for (const line of lines) {
  const m = /^(#{1,4})\s+(.*)$/.exec(line);
  if (m) {
    sections.push(cur);
    const level = m[1].length;
    const raw = m[2].trim();
    const num = /^(\d+(?:\.\d+)*)\.?\s+(.*)$/.exec(raw);
    const id = num ? num[1] : slug(raw);
    const title = (num ? num[2] : raw).replace(/\s*\[[^\]]*\]\s*$/, "").trim();
    const band = /\[(\d{3,4}-\d{3,4}[^\]]*|all levels)\]/.exec(raw)?.[1] ?? null;
    while (stack.length && stack[stack.length - 1][0] >= level) stack.pop();
    cur = { id, title, level, parent: stack.length ? stack[stack.length - 1][1] : null, band, lines: [] };
    stack.push([level, id]);
    continue;
  }
  cur.lines.push(line);
}
sections.push(cur);

const out = sections
  .map((s) => ({ id: s.id, title: s.title, level: s.level, parent: s.parent, band: s.band, text: s.lines.join("\n").trim() }))
  .filter((s) => s.text || s.level <= 2);
const ids = new Set();
for (const s of out) {
  if (ids.has(s.id)) throw new Error(`duplicate section id ${s.id}`);
  ids.add(s.id);
}
// Sanity: every non-heading line appears in some section.
const body = out.map((s) => s.text).join("\n");
const missing = lines.filter((l) => l.trim() && !/^#{1,4}\s/.test(l) && !body.includes(l.trim()));
if (missing.length) throw new Error(`lines missing from sections: ${missing.length}`);
writeFileSync(
  new URL("../app/src/lib/knowledge/sections.json", import.meta.url),
  JSON.stringify({ source: "knowledge/nimzo-knowledge-base.md", hash: createHash("sha256").update(src).digest("hex"), sections: out }, null, 1),
);
console.log(out.length, "sections;", out.reduce((n, s) => n + s.text.length, 0), "chars");
