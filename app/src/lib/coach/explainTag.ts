import "server-only";
import { z } from "zod";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";
import { env } from "@/lib/env";
import type { MoveFeatures } from "@/lib/analysis/features";
import { JEV_CRITERIA, TAG_BY_ID } from "@/lib/tags/catalog";
import { TAG_KNOWLEDGE, sectionText, sectionTitle } from "@/lib/knowledge";
import { structuredCall } from "./claude";
import { COACH_VOICE, TAG_EXPLAIN_TASK } from "./prompts";
import { notationIn } from "./guard";
import { plainMove } from "./plain";
import { longSentences, noDashes } from "./text";

export type TagExplanation = { text: string; learn: { id: string; title: string } | null; model: string };

/**
 * Arthur explains why one tag was put on one move: specific to that move, what
 * to do instead, and the habit from the knowledge base. Cached on the move row
 * so each explanation is written once.
 */
export async function explainTag(gameId: string, ply: number, tag: string): Promise<TagExplanation> {
  const def = TAG_BY_ID.get(tag);
  if (!def) throw new Error("unknown tag");
  const db = await getDb();
  const { data: row, error } = await db
    .from(T.move_features)
    .select("features, tags, note, intent, root_cause, tag_explanations")
    .eq("game_id", gameId)
    .eq("ply", ply)
    .maybeSingle();
  if (error) throw new Error(`load move: ${error.message}`);
  if (!row) throw new Error("move not found");
  const cached = (row.tag_explanations as Record<string, TagExplanation> | null)?.[tag];
  if (cached) return cached;

  const f = row.features as MoveFeatures;
  const sections = (TAG_KNOWLEDGE[tag] ?? []).slice(0, 2);
  const input = {
    move: plainMove(f, row.tags ?? [], { intent: row.intent, root_cause: row.root_cause }),
    arthurs_note_on_this_move: row.note,
    tag: { name: def.label, meaning: JEV_CRITERIA[tag] ?? def.plain, confirmed_by: def.source === "rule" ? "board analysis (certain)" : "the tagging model (a judgment)" },
    knowledge: sections.map((id) => sectionText(id, 3000)).filter(Boolean).join("\n\n"),
  };
  const schema = z.object({ text: z.string() });
  let user = JSON.stringify(input);
  let text = "";
  let model = env().CLAUDE_MODEL_COACH;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await structuredCall({ model: env().CLAUDE_MODEL_COACH, system: `${COACH_VOICE}\n\n${TAG_EXPLAIN_TASK}`, user, schema, effort: "low", maxTokens: 1500 });
    text = noDashes(res.data.text.trim());
    model = res.model;
    const bad = [...notationIn(text).map((n) => `notation ${n}`), ...longSentences(text, 24).map(() => "a sentence is too long")];
    if (!bad.length) break;
    if (attempt === 0) user = `${JSON.stringify(input)}\n\nRewrite: ${bad.join("; ")}. No notation or square names, short sentences.`;
  }
  const learn = sections[0] ? { id: sections[0], title: sectionTitle(sections[0]) ?? sections[0] } : null;
  const result: TagExplanation = { text, learn, model };
  const next = { ...((row.tag_explanations as Record<string, TagExplanation> | null) ?? {}), [tag]: result };
  await db.from(T.move_features).update({ tag_explanations: next }).eq("game_id", gameId).eq("ply", ply);
  return result;
}
