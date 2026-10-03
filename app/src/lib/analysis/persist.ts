import { Chess } from "chess.js";
import { z } from "zod";
import { pgnToPositions } from "../chess/pgn";
import { THRESHOLDS, gameAccuracy, judgeMove, whiteWinPct, type Score, type Thresholds } from "./math";

const scoreSchema = z.union([z.object({ cp: z.number().int() }), z.object({ mate: z.number().int() })]) as z.ZodType<Score>;
const uci = z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/);

export const enginePayloadSchema = z.object({
  engine: z.string().max(64),
  depth: z.number().int().min(1).max(40),
  positions: z
    .array(
      z.object({
        ply: z.number().int().min(0),
        score: scoreSchema,
        bestUci: uci.nullable(),
        pv: z.array(uci).max(20),
        terminal: z.enum(["checkmate", "stalemate", "draw"]).optional(),
      }),
    )
    .min(1)
    .max(1000),
  multipv: z
    .array(z.object({ ply: z.number().int().min(0), lines: z.array(z.object({ score: scoreSchema, pv: z.array(uci).max(20) })).max(5) }))
    .max(400),
});
export type EnginePayloadInput = z.infer<typeof enginePayloadSchema>;

export type PositionRow = {
  game_id: string;
  ply: number;
  fen: string;
  san: string | null;
  uci: string | null;
  is_mine: boolean;
  eval_cp: number | null;
  eval_mate: number | null;
  win_pct: number;
  clock_ms: number | null;
  time_spent_ms: number | null;
  classification: string | null;
  accuracy: number | null;
  best_move_uci: string | null;
  best_move_san: string | null;
  pv_san: string[] | null;
  multipv: unknown;
};

/** UCI line -> SAN, stopping at the first illegal move (so a bad PV can never reach the UI). */
export function uciLineToSan(fen: string, line: string[]): string[] {
  const c = new Chess(fen);
  const out: string[] = [];
  for (const m of line) {
    try {
      const mv = c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
      out.push(mv.san);
    } catch {
      break;
    }
  }
  return out;
}

/**
 * Turns the browser's raw engine output into position rows and game totals.
 * Deterministic: classifications and accuracy are computed here from the
 * shared math, not trusted from the client.
 */
export function buildAnalysis(args: {
  gameId: string;
  pgn: string;
  myColor: "white" | "black";
  payload: EnginePayloadInput;
  thresholds?: Thresholds;
}): {
  rows: PositionRow[];
  totals: { accuracy_ours: number | null; blunders: number; mistakes: number; inaccuracies: number };
} {
  const game = pgnToPositions(args.pgn);
  const n = game.plies.length;
  const evals = args.payload.positions;
  if (evals.length !== n + 1) throw new Error(`Expected ${n + 1} evaluated positions, got ${evals.length}`);
  evals.forEach((e, i) => {
    if (e.ply !== i) throw new Error(`Position ${i} out of order`);
  });

  const mine = args.myColor === "white" ? "w" : "b";
  const multipvByPly = new Map(args.payload.multipv.map((m) => [m.ply, m.lines]));
  const fens = [game.startFen, ...game.plies.map((p) => p.fenAfter)];
  const rows: PositionRow[] = [];
  const accs: number[] = [];
  const totals = { blunders: 0, mistakes: 0, inaccuracies: 0 };

  for (let i = 0; i <= n; i++) {
    const e = evals[i]!;
    const p = i > 0 ? game.plies[i - 1]! : null;
    const prev = i > 0 ? evals[i - 1]! : null;
    let classification: string | null = null;
    let accuracy: number | null = null;

    if (p && prev) {
      const j = judgeMove({
        before: prev.score,
        after: e.score,
        mover: p.color,
        playedBest: prev.bestUci === p.uci,
        deliversMate: e.terminal === "checkmate",
        thresholds: args.thresholds ?? THRESHOLDS,
      });
      classification = j.classification;
      accuracy = Math.round(j.accuracy * 100) / 100;
      if (p.color === mine) {
        accs.push(j.accuracy);
        if (j.classification === "blunder") totals.blunders++;
        else if (j.classification === "mistake") totals.mistakes++;
        else if (j.classification === "inaccuracy") totals.inaccuracies++;
      }
    }

    // Best move / line refer to the position BEFORE this ply (the alternative to the move played).
    const fenBefore = i > 0 ? fens[i - 1]! : null;
    const bestLine = prev && fenBefore ? uciLineToSan(fenBefore, prev.pv) : null;
    const mpv = i > 0 ? multipvByPly.get(i - 1) : undefined;

    rows.push({
      game_id: args.gameId,
      ply: i,
      fen: fens[i]!,
      san: p?.san ?? null,
      uci: p?.uci ?? null,
      is_mine: p ? p.color === mine : false,
      eval_cp: e.score.mate === undefined ? e.score.cp : null,
      eval_mate: e.score.mate ?? null,
      win_pct: Math.round(whiteWinPct(e.score) * 1000) / 1000,
      clock_ms: p?.clockMs ?? null,
      time_spent_ms: p?.timeSpentMs ?? null,
      classification,
      accuracy,
      best_move_uci: prev?.bestUci ?? null,
      best_move_san: bestLine?.[0] ?? null,
      pv_san: bestLine && bestLine.length ? bestLine : null,
      multipv:
        mpv && fenBefore
          ? mpv.map((l) => ({ score: l.score, pv_uci: l.pv, pv_san: uciLineToSan(fenBefore, l.pv) }))
          : null,
    });
  }

  const acc = gameAccuracy(accs);
  return { rows, totals: { accuracy_ours: acc === null ? null : Math.round(acc * 100) / 100, ...totals } };
}
