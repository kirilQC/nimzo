import "server-only";
import type { CoachInfo, ReviewData, ReviewPly } from "@/components/review/GameReview";
import { Chess } from "chess.js";
import { initialClockMs, pgnToPositions } from "@/lib/chess/pgn";
import { phaseOf } from "@/lib/analysis/features";
import { formatLine } from "@/lib/chess/lines";
import { formatScore, gameAccuracy, isSeverity, mateFor, type Score } from "@/lib/analysis/math";
import { MOVE_LABELS, isLabelId, type LabelId } from "@/lib/analysis/labels";
import { DIMENSIONS, motifLabel, tagLabel } from "@/lib/taxonomy";
import { TAG_BY_ID } from "@/lib/tags/catalog";

type TagsV2 = { version: 2; rules: string[]; merged: string[]; jev: { tags: Record<string, number> } | null };

export type MistakeRecord = {
  ply: number;
  tags: TagsV2 | {
    mistake_type?: { value: string; confidence: number | null; source: string };
    root_cause?: { value: string; confidence: number | null; source: string };
    motifs?: Record<string, { value: boolean; confidence: number | null; source: string }>;
  } | null;
  maia: { elo: number; p_played: number; p_best: number | null } | null;
  explanation: string | null;
};

/** "About 6 in 10 players at your level play this move." */
export function maiaSentence(m: NonNullable<MistakeRecord["maia"]>): string {
  const n = Math.round(m.p_played * 10);
  const played =
    m.p_played < 0.05 ? "Very few players at your level play this move" : n === 0 ? "About 1 in 20 players at your level play this move" : `About ${n} in 10 players at your level play this move`;
  if (m.p_best === null) return `${played}.`;
  const b = Math.round(m.p_best * 10);
  const best = m.p_best < 0.05 ? "almost none find the engine's move" : b === 0 ? "about 1 in 20 find the engine's move" : `${b} in 10 find the engine's move`;
  return `${played}; ${best}.`;
}

function tagChips(t: MistakeRecord["tags"], minConfidence: number) {
  if (!t) return [];
  if ("version" in t && t.version === 2) {
    // Rule tags are certain; Jev tags carry its probability. Problems first, then everything else.
    const order = (id: string) => (TAG_BY_ID.get(id)?.polarity === "bad" ? 0 : 1);
    return [...t.merged]
      .filter((id) => id !== "book_move")
      .sort((a, b) => order(a) - order(b))
      .slice(0, 8)
      .map((id) => ({ id, label: TAG_BY_ID.get(id)?.label ?? motifLabel(id), confidence: t.rules.includes(id) ? null : (t.jev?.tags[id] ?? null) }));
  }
  if ("version" in t) return [];
  const chips: { id: string; label: string; confidence: number | null }[] = [];
  const motifs = Object.entries(t.motifs ?? {})
    .filter(([, v]) => v.value)
    .sort((a, b) => (b[1].confidence ?? 0) - (a[1].confidence ?? 0));
  for (const [id, v] of motifs.slice(0, 3)) chips.push({ id, label: motifLabel(id), confidence: v.source === "detector" ? null : v.confidence });
  for (const [dim, key] of [["mistake_type", "mistake_type"], ["root_cause", "root_cause"]] as const) {
    const v = t[key];
    if (!v) continue;
    const unclear = (v.confidence ?? 0) < minConfidence;
    chips.push({ id: `${dim}:${v.value}`, label: unclear ? `${tagLabel(dim as keyof typeof DIMENSIONS, v.value)} (unclear)` : tagLabel(dim as keyof typeof DIMENSIONS, v.value), confidence: v.confidence });
  }
  return chips;
}

export type PositionRecord = {
  ply: number;
  eval_cp: number | null;
  eval_mate: number | null;
  win_pct: number | string | null;
  classification: string | null;
  accuracy?: number | string | null;
  best_move_san: string | null;
  best_move_uci?: string | null;
  pv_san: string[] | null;
  multipv: { score: Score; pv_san: string[] }[] | null;
  clock_ms: number | null;
};

const GROUP_ORDER = ["blunder", "missed", "found", "opening", "king", "trade", "structure", "endgame", "thinking", "strategy", "clock", "good", "context"];
/** Orders a move's tags for display: bad before good, certain (rule) before judged, then by how instructive the group is. */
function tagRank(t: { polarity: string; source: string; group: string }): number {
  return (t.polarity === "bad" ? 0 : 1000) + (t.source === "rule" ? 0 : 100) + GROUP_ORDER.indexOf(t.group);
}

/** The mover's winning chances (0-100) from a stored position's White win%. */
function winOf(p: PositionRecord | undefined, color: "w" | "b"): number | null {
  if (!p || p.win_pct === null || p.win_pct === undefined) return null;
  const w = Number(p.win_pct);
  return Math.round(color === "w" ? w : 100 - w);
}

function scoreOf(p: PositionRecord | undefined): Score | null {
  if (!p) return null;
  if (p.eval_mate !== null) return { mate: p.eval_mate };
  if (p.eval_cp !== null) return { cp: p.eval_cp };
  return null;
}

/** Builds the review board data from the PGN plus stored engine positions (if any). */
export function buildReviewData(args: {
  gameId: string | null;
  pgn: string;
  myColor: "white" | "black";
  status: string;
  error: string | null;
  positions: PositionRecord[];
  mistakes?: MistakeRecord[];
  minConfidence?: number;
  summary?: ReviewData["summary"];
  result?: ReviewData["result"];
  accuracy?: number | null;
  notes?: Map<number, string>;
  moveTags?: Map<number, string[]>;
}): ReviewData {
  const mistakeByPly = new Map((args.mistakes ?? []).map((m) => [m.ply, m]));
  const parsed = pgnToPositions(args.pgn);
  const mine = args.myColor === "white" ? "w" : "b";
  const byPly = new Map(args.positions.map((p) => [p.ply, p]));
  const analyzed = args.positions.length === parsed.plies.length + 1;

  const plies: ReviewPly[] = parsed.plies.map((p) => {
    const row = byPly.get(p.ply);
    return {
      ply: p.ply,
      san: p.san,
      from: p.from,
      to: p.to,
      color: p.color,
      fenAfter: p.fenAfter,
      clockMs: p.clockMs,
      spentMs: p.timeSpentMs,
      isMine: p.color === mine,
      severity: isSeverity(row?.classification) ? row.classification : null,
      label: isLabelId(row?.classification) ? row.classification : null,
      note: args.notes?.get(p.ply) ?? null,
      tags: (args.moveTags?.get(p.ply) ?? [])
        .map((id) => TAG_BY_ID.get(id))
        .filter((t): t is NonNullable<typeof t> => !!t && t.polarity !== "neutral")
        .sort((a, b) => tagRank(a) - tagRank(b))
        .map((t) => ({ id: t.id, label: t.label, polarity: t.polarity as "good" | "bad" })),
      bestUci: row?.best_move_uci ?? null,
      phase: phaseOf(new Chess(p.fenAfter), Math.ceil(p.ply / 2)),
      whitePct: row?.win_pct !== null && row?.win_pct !== undefined ? Number(row.win_pct) : null,
    };
  });

  const coach: Record<number, CoachInfo> = {};
  if (analyzed) {
    for (const p of plies) {
      if (!p.isMine || !p.severity) continue;
      const row = byPly.get(p.ply)!;
      const before = scoreOf(byPly.get(p.ply - 1));
      const after = scoreOf(row);
      const next = byPly.get(p.ply + 1); // its best move = opponent's best reply to my move
      const top = row.multipv?.[0];
      const bestLine = row.multipv?.[0]?.pv_san ?? row.pv_san;
      const mateBefore = before ? mateFor(before, p.color) : null;
      const mateAfter = after ? mateFor(after, p.color) : null;
      coach[p.ply] = {
        ply: p.ply,
        explanation: mistakeByPly.get(p.ply)?.explanation ?? null,
        bestMoveSan: row.best_move_san ? formatLine(p.ply, [row.best_move_san]) : null,
        bestMoveEval: formatScore(top?.score ?? before),
        bestMoveNote: null,
        bestLine: bestLine && bestLine.length > 1 ? formatLine(p.ply, bestLine.slice(0, 6)) : null,
        punishLine: next?.pv_san?.length ? formatLine(p.ply + 1, next.pv_san.slice(0, 6)) : null,
        punishEval: formatScore(after),
        missedMate: mateBefore !== null && mateBefore > 0 && (mateAfter === null || mateAfter <= 0),
        winBefore: winOf(byPly.get(p.ply - 1), p.color),
        winAfter: winOf(row, p.color),
        evalBefore: formatScore(before),
        evalAfter: formatScore(after),
        tags: tagChips(mistakeByPly.get(p.ply)?.tags ?? null, args.minConfidence ?? 0.6),
        maiaLine: mistakeByPly.get(p.ply)?.maia ? maiaSentence(mistakeByPly.get(p.ply)!.maia!) : null,
        relatedLesson: null,
      };
    }
  }

  // chess.com-style tally of every label, for both players, and the opponent's accuracy.
  const empty = () => Object.fromEntries(MOVE_LABELS.map((l) => [l.id, 0])) as Record<LabelId, number>;
  const counts = { me: empty(), opponent: empty() };
  const oppAccs: number[] = [];
  for (const p of plies) {
    if (p.label) counts[p.isMine ? "me" : "opponent"][p.label]++;
    const acc = byPly.get(p.ply)?.accuracy;
    if (!p.isMine && acc !== null && acc !== undefined) oppAccs.push(Number(acc));
  }
  const opp = analyzed ? gameAccuracy(oppAccs) : null;

  return {
    startClockMs: initialClockMs(parsed.headers.TimeControl),
    gameId: args.gameId,
    counts: analyzed ? counts : null,
    accuracyOpponent: opp === null ? null : Math.round(opp * 10) / 10,
    status: args.status,
    error: args.error,
    startFen: parsed.startFen,
    myColor: args.myColor,
    analyzed,
    summary: args.summary ?? null,
    result: args.result ?? null,
    accuracy: args.accuracy ?? null,
    coach,
    plies,
  };
}
