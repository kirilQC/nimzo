import { Chess } from "chess.js";

export type ParsedPly = {
  ply: number;            // 1-based; position after this move
  san: string;
  uci: string;
  from: string;
  to: string;
  color: "w" | "b";
  fenBefore: string;
  fenAfter: string;
  clockMs: number | null; // mover's clock after the move, from [%clk]
  timeSpentMs: number | null;
};

export type ParsedGame = {
  headers: Record<string, string>;
  startFen: string;
  plies: ParsedPly[];
};

/** Parses a [%clk h:mm:ss(.f)] value into milliseconds. Accepts m:ss as well. */
export function parseClock(value: string): number | null {
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(value.trim());
  if (!m) return null;
  const h = m[1] ? Number(m[1]) : 0;
  const min = Number(m[2]);
  const sec = Number(m[3]);
  return Math.round(((h * 60 + min) * 60 + sec) * 1000);
}

/** Extracts the clock from a move comment such as "[%clk 0:04:58.3]". */
export function clockFromComment(comment: string | undefined): number | null {
  if (!comment) return null;
  const m = /\[%clk\s+([0-9:.]+)\]/.exec(comment);
  return m ? parseClock(m[1]!) : null;
}

/** Increment in ms from a chess.com time_control like "300+2" or "600". */
export function incrementMs(timeControl: string | undefined | null): number {
  if (!timeControl) return 0;
  const m = /^\d+\+(\d+(?:\.\d+)?)$/.exec(timeControl);
  return m ? Math.round(Number(m[1]) * 1000) : 0;
}

export function initialClockMs(timeControl: string | undefined | null): number | null {
  if (!timeControl) return null;
  const m = /^(\d+)(?:\+[\d.]+)?$/.exec(timeControl);
  return m ? Number(m[1]) * 1000 : null;
}

/**
 * PGN -> per-ply positions with clocks. Time spent = previous clock of the same
 * side - this clock + increment (clamped at 0).
 */
export function pgnToPositions(pgn: string): ParsedGame {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const headers = chess.getHeaders() as Record<string, string>;
  const comments = new Map(chess.getComments().map((c) => [c.fen, c.comment]));
  const history = chess.history({ verbose: true });

  const startFen = history[0]?.before ?? chess.fen();
  const tc = headers.TimeControl;
  const inc = incrementMs(tc);
  const start = initialClockMs(tc);
  const lastClock: Record<"w" | "b", number | null> = { w: start, b: start };

  const plies: ParsedPly[] = history.map((mv, i) => {
    const clockMs = clockFromComment(comments.get(mv.after));
    const prev = lastClock[mv.color];
    const timeSpentMs = clockMs !== null && prev !== null ? Math.max(0, prev - clockMs + inc) : null;
    if (clockMs !== null) lastClock[mv.color] = clockMs;
    return {
      ply: i + 1,
      san: mv.san,
      uci: mv.from + mv.to + (mv.promotion ?? ""),
      from: mv.from,
      to: mv.to,
      color: mv.color,
      fenBefore: mv.before,
      fenAfter: mv.after,
      clockMs,
      timeSpentMs,
    };
  });

  return { headers, startFen, plies };
}

export function formatClock(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
