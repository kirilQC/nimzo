import { Chess } from "chess.js";
import { pgnToPositions } from "../chess/pgn";
import { THRESHOLDS, isSeverity, judgeMove, type Score, type Thresholds } from "./math";
import { toWhitePerspective, type UciLine } from "./uci";

/** Anything that can search a FEN: the browser Web Worker, or a Node process in tests. */
export interface Engine {
  /** Lines sorted by multipv, scores from the SIDE TO MOVE's perspective. */
  search(fen: string, opts: { depth: number; multipv: number }): Promise<UciLine[]>;
}

export type EngineLine = { score: Score; pv: string[] }; // White's perspective, UCI moves

export type PositionEval = {
  ply: number; // 0 = start position, n = after move n
  score: Score; // White's perspective
  bestUci: string | null;
  pv: string[]; // best line from this position (UCI), truncated
  terminal?: "checkmate" | "stalemate" | "draw";
};

export type EnginePayload = {
  engine: string;
  depth: number;
  positions: PositionEval[];
  multipv: { ply: number; lines: EngineLine[] }[]; // for the position BEFORE each of my flagged moves
};

export const ENGINE_NAME = "stockfish-19-lite-single";
export const DEFAULT_DEPTH = 16;
export const PV_PLIES = 8;

function terminalEval(fen: string): Omit<PositionEval, "ply"> | null {
  const c = new Chess(fen);
  if (c.isCheckmate()) {
    // Side to move is mated.
    return { score: { cp: c.turn() === "w" ? -1000 : 1000 }, bestUci: null, pv: [], terminal: "checkmate" };
  }
  if (c.isStalemate()) return { score: { cp: 0 }, bestUci: null, pv: [], terminal: "stalemate" };
  if (c.isInsufficientMaterial()) return { score: { cp: 0 }, bestUci: null, pv: [], terminal: "draw" };
  return null;
}

/**
 * Engine pass for one game: evaluates every position at fixed depth (MultiPV 1),
 * then re-searches the position before each of MY flagged moves with MultiPV 3.
 * Pure orchestration, so it runs the same in the browser and in tests.
 */
export async function runEngineAnalysis(args: {
  pgn: string;
  myColor: "white" | "black";
  engine: Engine;
  depth?: number;
  thresholds?: Thresholds;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}): Promise<EnginePayload> {
  const depth = args.depth ?? DEFAULT_DEPTH;
  const game = pgnToPositions(args.pgn);
  const fens = [game.startFen, ...game.plies.map((p) => p.fenAfter)];
  const mine = args.myColor === "white" ? "w" : "b";

  // Pass 1 budget: every position, plus a guess of ~4 flagged re-searches.
  let total = fens.length + 4;
  const positions: PositionEval[] = [];

  for (let i = 0; i < fens.length; i++) {
    if (args.signal?.aborted) throw new DOMException("Analysis cancelled", "AbortError");
    const fen = fens[i]!;
    const term = terminalEval(fen);
    if (term) {
      positions.push({ ply: i, ...term });
    } else {
      const [top] = await args.engine.search(fen, { depth, multipv: 1 });
      if (!top) throw new Error(`Engine returned no line for ply ${i}`);
      const stm = fen.split(" ")[1] as "w" | "b";
      positions.push({ ply: i, score: toWhitePerspective(top.score, stm), bestUci: top.pv[0] ?? null, pv: top.pv.slice(0, PV_PLIES) });
    }
    args.onProgress?.(i + 1, total);
  }

  // Which of my moves are flagged?
  const flagged: number[] = [];
  for (const p of game.plies) {
    if (p.color !== mine) continue;
    const before = positions[p.ply - 1]!;
    const after = positions[p.ply]!;
    const j = judgeMove({
      before: before.score,
      after: after.score,
      mover: p.color,
      playedBest: before.bestUci === p.uci,
      deliversMate: after.terminal === "checkmate",
      thresholds: args.thresholds ?? THRESHOLDS,
    });
    if (isSeverity(j.classification)) flagged.push(p.ply);
  }

  total = fens.length + flagged.length;
  const multipv: EnginePayload["multipv"] = [];
  for (const [k, ply] of flagged.entries()) {
    if (args.signal?.aborted) throw new DOMException("Analysis cancelled", "AbortError");
    const fen = fens[ply - 1]!;
    const stm = fen.split(" ")[1] as "w" | "b";
    const lines = await args.engine.search(fen, { depth, multipv: 3 });
    multipv.push({
      ply: ply - 1,
      lines: lines.slice(0, 3).map((l) => ({ score: toWhitePerspective(l.score, stm), pv: l.pv.slice(0, PV_PLIES) })),
    });
    args.onProgress?.(fens.length + k + 1, total);
  }

  return { engine: ENGINE_NAME, depth, positions, multipv };
}
