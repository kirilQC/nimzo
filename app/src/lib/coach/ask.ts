import "server-only";
import { z } from "zod";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";
import { env } from "@/lib/env";
import { logError } from "@/lib/log";
import { formatLine } from "@/lib/chess/lines";
import { pgnToPositions } from "@/lib/chess/pgn";
import { formatScore } from "@/lib/analysis/math";
import type { MoveFacts } from "@/lib/analysis/facts";
import { knowledgeFor, searchKnowledge, sectionText } from "@/lib/knowledge";
import { structuredCall } from "./claude";
import { COACH_VOICE, GAME_QA_TASK } from "./prompts";
import { playerMemory } from "@/lib/profile/memory";
import { notationIn } from "./guard";
import { longSentences, noDashes } from "./text";
import { EXPRESSIONS, QA_EXPRESSIONS, type Expression } from "./expressions";

type PositionRow = { ply: number; san: string | null; eval_cp: number | null; eval_mate: number | null; best_move_san: string | null; pv_san: string[] | null; classification: string | null };

/**
 * Answers a question about one game, grounded in its stored engine data and the
 * knowledge base (sections for the patterns in play plus a search on the
 * question). Persists the thread. Answers follow the house style.
 */
export async function askAboutGame(gameId: string, question: string, ply: number): Promise<{ answer: string; expression: Expression; threadId: string }> {
  const db = await getDb();
  const [{ data: game }, { data: positions }, { data: mistakes }, { data: review }, { data: moveRows }] = await Promise.all([
    db.from(T.games).select("pgn, my_color, opponent, result, opening_name, accuracy_ours").eq("id", gameId).single(),
    db.from(T.positions).select("ply, san, eval_cp, eval_mate, best_move_san, pv_san, classification").eq("game_id", gameId).order("ply"),
    db.from(T.mistakes).select("ply, facts, explanation").eq("game_id", gameId).order("ply"),
    db.from(T.game_reviews).select("summary").eq("game_id", gameId).maybeSingle(),
    db.from(T.move_features).select("ply, tags, is_mine, note").eq("game_id", gameId),
  ]);
  if (!game) throw new Error("game not found");

  // One thread per game.
  let { data: thread } = await db.from(T.chat_threads).select("id").eq("game_id", gameId).maybeSingle();
  if (!thread) {
    const ins = await db.from(T.chat_threads).insert({ game_id: gameId, title: `vs ${game.opponent}` }).select("id").single();
    if (ins.error) throw new Error(`create thread: ${ins.error.message}`);
    thread = ins.data;
  }
  const { data: history } = await db
    .from(T.chat_messages)
    .select("role, content")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: false })
    .limit(8);

  const plies = pgnToPositions(game.pgn).plies;
  const moveList = plies.map((p) => formatLine(p.ply, [p.san])).join(" ");
  const pos = (positions ?? []) as PositionRow[];
  const here = pos.find((p) => p.ply === ply);
  const next = pos.find((p) => p.ply === ply + 1);
  const score = (p?: PositionRow) => (p ? formatScore(p.eval_mate !== null ? { mate: p.eval_mate } : { cp: p.eval_cp ?? 0 }) : null);
  const flaggedPlies = new Set((mistakes ?? []).map((m) => m.ply as number));
  const relevantTags = (moveRows ?? [])
    .filter((m) => m.is_mine && (m.ply === ply || m.ply === ply + 1 || flaggedPlies.has(m.ply)))
    .flatMap((m) => (m.tags as string[] | null) ?? []);

  const context = {
    game: { player_color: game.my_color, opponent: game.opponent, result_for_player: game.result, opening: game.opening_name, accuracy: game.accuracy_ours, moves: moveList },
    your_earlier_summary: review?.summary ?? null,
    flagged_moves: (mistakes ?? []).map((m) => {
      const f = m.facts as MoveFacts;
      return {
        move_number: f.move_number,
        severity: f.classification,
        eval_before: f.eval_before,
        eval_after: f.eval_after,
        engine_preferred: f.engine_best,
        opponent_best_reply: f.opponent_best_reply,
        clock: f.clock,
        your_note: m.explanation,
      };
    }),
    position_player_is_looking_at: here
      ? {
          after_move: here.san ? formatLine(ply, [here.san]) : "start of the game",
          your_note_on_it: (moveRows ?? []).find((m) => m.ply === ply)?.note ?? null,
          eval_white_pov: score(here),
          classification_of_that_move: here.classification,
          engine_best_next_move: next?.best_move_san ? formatLine(ply + 1, [next.best_move_san]) : null,
          engine_best_line_from_here: next?.pv_san?.length ? formatLine(ply + 1, next.pv_san) : null,
        }
      : null,
    knowledge: [...searchKnowledge(question, 2).map((id) => sectionText(id, 3000)), knowledgeFor({ tags: relevantTags, opening: game.opening_name, budget: 5000 }).text]
      .filter(Boolean)
      .join("\n\n"),
    recent_conversation: (history ?? []).reverse().map((h) => ({ role: h.role, text: (h.content as { text?: string }).text ?? "" })),
    question,
  };

  const faces = QA_EXPRESSIONS.map((e) => `- ${e}: ${EXPRESSIONS[e]}`).join("\n");
  const system = `${COACH_VOICE}\n\n${await playerMemory()}\n\n${GAME_QA_TASK}\n\nAlso choose the facial expression you'd naturally have while saying your answer:\n${faces}`;
  const schema = z.object({ answer: z.string(), expression: z.enum(QA_EXPRESSIONS as [Expression, ...Expression[]]) });
  let user = JSON.stringify(context);
  let answer = "";
  let expression: Expression = "explaining";
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data } = await structuredCall({ model: env().CLAUDE_MODEL_COACH, system, user, schema, effort: "medium", maxTokens: 4000 });
    answer = noDashes(data.answer.trim());
    expression = data.expression;
    const bad = [...notationIn(answer).map((n) => `notation ${n}`), ...longSentences(answer, 24).map(() => "a sentence over 24 words")];
    if (!bad.length) break;
    await logError("coach.guard", new Error("answer broke the house style"), { bad, attempt }, gameId);
    if (attempt === 0) user = `${JSON.stringify(context)}\n\nRewrite your answer: ${bad.join(", ")}. No notation or square names, short sentences.`;
  }

  await db.from(T.chat_messages).insert([
    { thread_id: thread.id, role: "user", content: { text: question, ply } },
    { thread_id: thread.id, role: "assistant", content: { text: answer, expression }, model: env().CLAUDE_MODEL_COACH },
  ]);
  await db.from(T.chat_threads).update({ updated_at: new Date().toISOString() }).eq("id", thread.id);
  return { answer, expression, threadId: thread.id };
}
