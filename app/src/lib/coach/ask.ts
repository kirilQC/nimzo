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
import { structuredCall } from "./claude";
import { COACH_VOICE, GAME_QA_TASK } from "./prompts";
import { sanSet, unknownMoves } from "./guard";

type PositionRow = { ply: number; san: string | null; eval_cp: number | null; eval_mate: number | null; best_move_san: string | null; pv_san: string[] | null; classification: string | null };

/** Answers a question about one game, grounded in its stored engine data. Persists the thread. */
export async function askAboutGame(gameId: string, question: string, ply: number): Promise<{ answer: string; threadId: string }> {
  const db = await getDb();
  const [{ data: game }, { data: positions }, { data: mistakes }, { data: review }] = await Promise.all([
    db.from(T.games).select("pgn, my_color, opponent, result, opening_name, accuracy_ours").eq("id", gameId).single(),
    db.from(T.positions).select("ply, san, eval_cp, eval_mate, best_move_san, pv_san, classification").eq("game_id", gameId).order("ply"),
    db.from(T.mistakes).select("ply, facts, explanation").eq("game_id", gameId).order("ply"),
    db.from(T.game_reviews).select("summary").eq("game_id", gameId).maybeSingle(),
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
  const pos = ((positions ?? []) as PositionRow[]);
  const here = pos.find((p) => p.ply === ply);
  const next = pos.find((p) => p.ply === ply + 1);
  const score = (p?: PositionRow) => (p ? formatScore(p.eval_mate !== null ? { mate: p.eval_mate } : { cp: p.eval_cp ?? 0 }) : null);

  const context = {
    game: { player_color: game.my_color, opponent: game.opponent, result_for_player: game.result, opening: game.opening_name, accuracy: game.accuracy_ours, moves: moveList },
    your_earlier_summary: review?.summary ?? null,
    flagged_moves: (mistakes ?? []).map((m) => {
      const f = m.facts as MoveFacts;
      return {
        move: `${f.move_number}${f.side === "white" ? "." : "..."} ${f.san}`,
        severity: f.classification,
        eval_before: f.eval_before,
        eval_after: f.eval_after,
        engine_preferred: f.engine_best,
        opponent_best_reply: f.opponent_best_reply,
        clock: f.clock,
        your_explanation: m.explanation,
      };
    }),
    position_player_is_looking_at: here
      ? {
          after_move: here.san ? formatLine(ply, [here.san]) : "start of the game",
          eval_white_pov: score(here),
          classification_of_that_move: here.classification,
          engine_best_next_move: next?.best_move_san ? formatLine(ply + 1, [next.best_move_san]) : null,
          engine_best_line_from_here: next?.pv_san?.length ? formatLine(ply + 1, next.pv_san) : null,
        }
      : null,
    recent_conversation: (history ?? []).reverse().map((h) => ({ role: h.role, text: (h.content as { text?: string }).text ?? "" })),
    question,
  };

  const allowed = sanSet([
    moveList,
    ...pos.map((p) => (p.pv_san?.length ? formatLine(p.ply, p.pv_san) : null)),
    ...pos.map((p) => p.best_move_san),
    ...(mistakes ?? []).flatMap((m) => {
      const f = m.facts as MoveFacts;
      return [f.engine_best.line, f.opponent_best_reply.line, ...f.alternatives.map((a) => a.line)];
    }),
  ]);

  const system = `${COACH_VOICE}\n\n${GAME_QA_TASK}`;
  let user = JSON.stringify(context);
  let answer = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data } = await structuredCall({ model: env().CLAUDE_MODEL_COACH, system, user, schema: z.object({ answer: z.string() }), effort: "medium", maxTokens: 4000 });
    answer = data.answer.trim();
    const bad = unknownMoves(answer, allowed);
    if (!bad.length) break;
    await logError("coach.guard", new Error("answer mentioned moves not in data"), { bad, attempt }, gameId);
    if (attempt === 0) user = `${JSON.stringify(context)}\n\nYour previous answer mentioned moves that are not in the data (${bad.join(", ")}). Answer again using only moves from the data.`;
  }

  await db.from(T.chat_messages).insert([
    { thread_id: thread.id, role: "user", content: { text: question, ply } },
    { thread_id: thread.id, role: "assistant", content: { text: answer }, model: env().CLAUDE_MODEL_COACH },
  ]);
  await db.from(T.chat_threads).update({ updated_at: new Date().toISOString() }).eq("id", thread.id);
  return { answer, threadId: thread.id };
}
