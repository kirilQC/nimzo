import { Chess } from "chess.js";
import { chesscomGameSchema, type ChesscomGame, type ChesscomStats } from "./schema";

const DRAW_CODES = new Set(["agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"]);

export type GameRow = {
  source: "chesscom";
  chesscom_uuid: string | null;
  chesscom_url: string;
  pgn: string;
  my_color: "white" | "black";
  opponent: string;
  opponent_rating: number | null;
  my_rating: number | null;
  result: "win" | "loss" | "draw";
  result_detail: string;
  time_class: string;
  time_control: string;
  rated: boolean | null;
  end_time: string;
  eco: string | null;
  opening_name: string | null;
  accuracy_chesscom: number | null;
  move_count: number;
  session_id: string | null;
};

/** Full moves played (1. e4 e5 is one move; a game ending on White's move rounds up). */
export function moveCount(pgn: string): number {
  const c = new Chess();
  c.loadPgn(pgn);
  return Math.ceil(c.history().length / 2);
}

export function dedupeKey(g: { uuid?: string | null; url: string }): string {
  return g.uuid ? `uuid:${g.uuid}` : `url:${g.url}`;
}

/** My side is whichever player has my username (case-insensitive). */
export function myColor(g: Pick<ChesscomGame, "white" | "black">, username: string): "white" | "black" | null {
  const u = username.trim().toLowerCase();
  if (g.white.username.toLowerCase() === u) return "white";
  if (g.black.username.toLowerCase() === u) return "black";
  return null;
}

export function resultFor(myResult: string): "win" | "loss" | "draw" {
  if (myResult === "win") return "win";
  if (DRAW_CODES.has(myResult)) return "draw";
  return "loss";
}

/** "https://www.chess.com/openings/Sicilian-Defense-Alapin-Variation-2...Nf6-3.e5" -> "Sicilian Defense Alapin Variation" */
export function openingNameFromUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  const m = /\/openings\/([^/?#]+)/.exec(url);
  if (!m) return null;
  const words: string[] = [];
  for (const token of decodeURIComponent(m[1]!).split("-")) {
    if (/^\d+\./.test(token)) break; // move sequence starts
    if (token) words.push(token);
  }
  return words.length && words.join(" ") !== "Undefined" ? words.join(" ") : null;
}

function pgnHeader(pgn: string, name: string): string | null {
  const m = new RegExp(`\\[${name} "([^"]*)"\\]`).exec(pgn);
  return m ? m[1]! : null;
}

export type MapOutcome = { row: GameRow } | { skip: string };

/**
 * Validates and maps one raw archive entry. Only standard chess (`rules === "chess"`)
 * with a parseable PGN is imported; every time class is kept.
 */
export function mapGame(raw: unknown, username: string, activeSession: { id: string; started_at: string } | null): MapOutcome {
  const parsed = chesscomGameSchema.safeParse(raw);
  if (!parsed.success) return { skip: `invalid game shape: ${parsed.error.issues[0]?.message ?? "unknown"}` };
  const g = parsed.data;
  if (g.rules !== "chess") return { skip: `variant ${g.rules}` };
  if (!g.pgn) return { skip: "no pgn" };
  const color = myColor(g, username);
  if (!color) return { skip: "not my game" };

  let moves: number;
  try {
    moves = moveCount(g.pgn);
  } catch (e) {
    return { skip: `unparseable pgn: ${(e as Error).message}` };
  }

  const me = g[color];
  const opp = g[color === "white" ? "black" : "white"];
  const result = resultFor(me.result);
  const endIso = new Date(g.end_time * 1000).toISOString();
  const inSession = activeSession && endIso >= new Date(activeSession.started_at).toISOString();

  return {
    row: {
      source: "chesscom",
      chesscom_uuid: g.uuid ?? null,
      chesscom_url: g.url,
      pgn: g.pgn,
      my_color: color,
      opponent: opp.username,
      opponent_rating: opp.rating ?? null,
      my_rating: me.rating ?? null,
      result,
      result_detail: result === "win" ? opp.result : me.result,
      time_class: g.time_class,
      time_control: g.time_control,
      rated: g.rated ?? null,
      end_time: endIso,
      eco: pgnHeader(g.pgn, "ECO"),
      opening_name: openingNameFromUrl(g.eco ?? pgnHeader(g.pgn, "ECOUrl")),
      accuracy_chesscom: g.accuracies?.[color] ?? null,
      move_count: moves,
      session_id: inSession ? activeSession.id : null,
    },
  };
}

/** Drops games already stored (by uuid, falling back to url) and duplicates within the batch. */
export function newGamesOnly(rows: GameRow[], existing: { chesscom_uuid: string | null; chesscom_url: string | null }[]): GameRow[] {
  const seen = new Set<string>();
  for (const e of existing) {
    if (e.chesscom_uuid) seen.add(`uuid:${e.chesscom_uuid}`);
    if (e.chesscom_url) seen.add(`url:${e.chesscom_url}`);
  }
  const out: GameRow[] = [];
  for (const r of rows) {
    const keys = [r.chesscom_uuid ? `uuid:${r.chesscom_uuid}` : null, `url:${r.chesscom_url}`].filter((k): k is string => !!k);
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    out.push(r);
  }
  return out;
}

export type YearMonth = { year: number; month: number };

export function ymKey({ year, month }: YearMonth): string {
  return `${year}/${String(month).padStart(2, "0")}`;
}

export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

export function utcYearMonth(d: Date): YearMonth {
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

/** Days into the month during which we also re-check last month's archive. */
export const ROLLOVER_DAYS = 3;

/**
 * Which monthly archives a regular (non-backfill) sync should check.
 * Always the current UTC month. Also the previous month during the first
 * ROLLOVER_DAYS days, or whenever it hasn't been checked since it ended
 * (so a game finished at 23:59 on the 31st is never missed).
 */
export function monthsToCheck(now: Date, prevMonthLastChecked: Date | null): YearMonth[] {
  const current = utcYearMonth(now);
  const prev = addMonths(current, -1);
  const monthStart = new Date(Date.UTC(current.year, current.month - 1, 1));
  const inRollover = now.getUTCDate() <= ROLLOVER_DAYS;
  const prevStale = !prevMonthLastChecked || prevMonthLastChecked < monthStart;
  return inRollover || prevStale ? [prev, current] : [current];
}

/** Archive URLs within the last `months` calendar months (inclusive of the current one). */
export function backfillArchives(archiveUrls: string[], now: Date, months: number): string[] {
  const oldest = addMonths(utcYearMonth(now), -(months - 1));
  const oldestIdx = oldest.year * 12 + oldest.month;
  return archiveUrls.filter((u) => {
    const m = /\/games\/(\d{4})\/(\d{2})$/.exec(u);
    if (!m) return false;
    return Number(m[1]) * 12 + Number(m[2]) >= oldestIdx;
  });
}

export function parseArchiveUrl(u: string): YearMonth | null {
  const m = /\/games\/(\d{4})\/(\d{2})$/.exec(u);
  return m ? { year: Number(m[1]), month: Number(m[2]) } : null;
}

/** Current rating per time class from /stats. */
export function ratingsFromStats(stats: ChesscomStats): Record<string, number> {
  const out: Record<string, number> = {};
  for (const tc of ["rapid", "blitz", "bullet", "daily"] as const) {
    const r = stats[`chess_${tc}`]?.last?.rating;
    if (typeof r === "number") out[tc] = r;
  }
  return out;
}

/** A past month's archive is complete once it was checked after that month ended. */
export function archiveComplete(url: string, lastChecked: string | null | undefined): boolean {
  const ym = parseArchiveUrl(url);
  if (!ym || !lastChecked) return false;
  const end = new Date(Date.UTC(ym.year, ym.month, 1)); // first instant of the next month
  return new Date(lastChecked) >= end;
}
