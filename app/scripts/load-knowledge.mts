// Loads the knowledge base into Supabase: the source file to storage, one lesson
// per chapter, one chunk per section, each chunk tagged with the move tags it teaches.
// Idempotent: replaces the previous copy of the same document.
// Usage (from app/): NIMZO_SCRIPT=1 npx tsx --env-file=.env.local scripts/load-knowledge.mts
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { SECTIONS, TAG_KNOWLEDGE } from "../src/lib/knowledge";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
const FILE = "nimzo-knowledge-base.md";
const src = readFileSync(new URL(`../../knowledge/${FILE}`, import.meta.url), "utf8");
const hash = createHash("sha256").update(src).digest("hex");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const up = await db.storage.from("nimzo-knowledge").upload(`kb/${FILE}`, new Blob([src], { type: "text/markdown" }), { upsert: true, contentType: "text/markdown" });
if (up.error) throw up.error;

// Replace any earlier copy.
const { data: old } = await db.from("nimzo_knowledge_documents").select("id").eq("filename", FILE);
for (const o of old ?? []) {
  await db.from("nimzo_lessons").delete().eq("document_id", o.id);
  await db.from("nimzo_knowledge_documents").delete().eq("id", o.id);
}
const { data: doc, error: docErr } = await db
  .from("nimzo_knowledge_documents")
  .insert({ storage_path: `kb/${FILE}`, filename: FILE, content_hash: hash, status: "done", ingested_at: new Date().toISOString(), summary: { sections: SECTIONS.length } })
  .select("id")
  .single();
if (docErr) throw docErr;

const CATEGORY: Record<string, string> = {
  "2": "beginner_principles", "3": "common_blunders", "4": "tactics", "5": "tactics", "6": "openings",
  "7": "middlegame_plans", "8": "endgames", "9": "middlegame_plans", "10": "beginner_principles", "11": "beginner_principles",
};
const PHASE: Record<string, string> = { "6": "opening", "7": "middlegame", "8": "endgame" };
const chapterOf = (id: string) => (/^\d+/.exec(id)?.[0] ?? "0");
const tagsFor = new Map<string, string[]>();
for (const [tag, ids] of Object.entries(TAG_KNOWLEDGE)) for (const id of ids) tagsFor.set(id, [...(tagsFor.get(id) ?? []), tag]);

const chapters = [...new Set(SECTIONS.map((s) => chapterOf(s.id)))];
let lessons = 0, chunks = 0;
for (const [order, ch] of chapters.entries()) {
  const secs = SECTIONS.filter((s) => chapterOf(s.id) === ch);
  const head = secs.find((s) => s.id === ch) ?? secs[0]!;
  const title = ch === "0" ? "About this knowledge base" : head.title;
  const { data: lesson, error } = await db
    .from("nimzo_lessons")
    .insert({
      document_id: doc.id,
      title,
      slug: `kb-${ch}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50)}`,
      category: CATEGORY[ch] ?? "beginner_principles",
      level: head.band,
      content_hash: sha(secs.map((s) => s.text).join("\n")),
      sort_order: order,
    })
    .select("id")
    .single();
  if (error) throw error;
  lessons++;
  const rows = secs
    .filter((s) => s.text)
    .map((s, i) => ({
      lesson_id: lesson.id,
      chunk_index: i,
      heading: `${/^\d/.test(s.id) ? `${s.id} ` : ""}${s.title}`,
      content: s.text,
      content_hash: sha(s.text),
      tags: { section: s.id, parent: s.parent },
      motifs: tagsFor.get(s.id) ?? [],
      phase: PHASE[ch] ?? null,
      level: s.band,
      token_count: Math.ceil(s.text.length / 4),
    }));
  if (rows.length) {
    const { error: e } = await db.from("nimzo_lesson_chunks").insert(rows);
    if (e) throw e;
    chunks += rows.length;
  }
}
console.log(`document ${doc.id}: ${lessons} lessons, ${chunks} chunks`);
