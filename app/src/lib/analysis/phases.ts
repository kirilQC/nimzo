import type { LabelId } from "./labels";

export type Phase = "opening" | "middlegame" | "endgame";
export type PhasePoint = { ply: number; phase: Phase; myPct: number | null; label: LabelId | null; isMine: boolean };
export type PhaseSegment = { phase: Phase; title: string; fromPly: number; toPly: number; fromMove: number; toMove: number; story: string | null };
export type GameEnd = { result: "win" | "loss" | "draw" | null; ending: string | null }; // ending: Checkmate, Resignation, Timeout...

const RANK: Record<Phase, number> = { opening: 0, middlegame: 1, endgame: 2 };
const TITLE: Record<Phase, string> = { opening: "Opening", middlegame: "Middlegame", endgame: "Endgame" };
const WORDS = ["no", "one", "two", "three", "four", "five", "six"];

function count(n: number, one: string, many: string): string {
  return `${n === 1 ? (/^[aeiou]/.test(one) ? "an" : "a") : (WORDS[n] ?? String(n))} ${n === 1 ? one : many}`;
}

/**
 * Splits a game into its parts. Phases only move forward (a position that briefly
 * looks like an endgame and then isn't stays in the endgame), and a part of one
 * or two moves joins the part before it.
 */
export function phaseSegments(points: PhasePoint[], end: GameEnd): PhaseSegment[] {
  const segs: { phase: Phase; from: number; to: number }[] = [];
  for (const p of points) {
    const last = segs.at(-1);
    if (!last) segs.push({ phase: p.phase, from: p.ply, to: p.ply });
    else if (RANK[p.phase] > RANK[last.phase]) segs.push({ phase: p.phase, from: p.ply, to: p.ply });
    else last.to = p.ply;
  }
  for (let i = segs.length - 1; i > 0; i--) {
    if (segs[i]!.to - segs[i]!.from < 3) {
      segs[i - 1]!.to = segs[i]!.to;
      segs.splice(i, 1);
    }
  }
  // Each part starts on a full move (White's turn), so move ranges never overlap.
  for (let i = 1; i < segs.length; i++) {
    if (segs[i]!.from % 2 === 0 && segs[i]!.from < segs[i]!.to) {
      segs[i]!.from += 1;
      segs[i - 1]!.to += 1;
    }
  }
  const byPly = new Map(points.map((p) => [p.ply, p]));
  return segs.map((s, i) => {
    const inside = points.filter((p) => p.ply >= s.from && p.ply <= s.to);
    return {
      phase: s.phase,
      title: TITLE[s.phase],
      fromPly: s.from,
      toPly: s.to,
      fromMove: Math.ceil(s.from / 2),
      toMove: Math.ceil(s.to / 2),
      story: phaseStory(inside, byPly.get(s.from - 1)?.myPct ?? 50, i === 0, i === segs.length - 1, end),
    };
  });
}

/** One plain line about a part of the game, from the numbers only: how your chances moved, your slips, theirs, and the ending. */
export function phaseStory(points: PhasePoint[], startPct: number, isFirst: boolean, isLast: boolean, end: GameEnd): string | null {
  const pcts = points.map((p) => p.myPct).filter((v): v is number => v !== null);
  if (!pcts.length) return null;
  const endPct = pcts.at(-1)!;
  const min = Math.min(startPct, ...pcts), max = Math.max(startPct, ...pcts);
  const mine = (l: LabelId) => points.filter((p) => p.isMine && p.label === l).length;
  const theirs = (l: LabelId) => points.filter((p) => !p.isMine && p.label === l).length;
  const blunders = mine("blunder"), mistakes = mine("mistake"), misses = mine("miss");
  const goods = mine("brilliant") + mine("great");
  const theirSlips = theirs("blunder") + theirs("mistake");

  const bad = [blunders && count(blunders, "blunder", "blunders"), mistakes && count(mistakes, "mistake", "mistakes"), misses && count(misses, "missed chance", "missed chances")].filter(Boolean) as string[];
  const badText = bad.length > 1 ? `${bad.slice(0, -1).join(", ")} and ${bad.at(-1)}` : bad[0];
  const goodText = goods ? (mine("brilliant") ? "a brilliant move" : goods > 1 ? "some great finds" : "a great find") : null;
  const d = endPct - startPct;

  let line: string;
  if (max - min >= 45 && (badText || theirSlips)) {
    line = `Wild swings: ${badText ?? "they slipped, then you did"}${goodText ? `, then ${goodText}` : ""}`;
  } else if (d >= 15) {
    const lead = endPct >= 80 ? "you took over" : "you pulled ahead";
    line = theirSlips && !badText ? `They slipped and ${lead}` : `${lead[0]!.toUpperCase()}${lead.slice(1)}${badText ? ` despite ${badText}` : ""}`;
  } else if (d <= -15) {
    line = `${endPct <= 20 ? "It fell apart" : "You slipped behind"}${badText ? ` after ${badText}` : ""}`;
  } else {
    line =
      endPct >= 75 ? "You stayed in control"
      : endPct >= 58 ? "You were a little better"
      : endPct > 42 ? (isFirst ? "An even, calm start" : "Even and steady")
      : endPct > 25 ? "You were under some pressure"
      : "You were in real trouble";
    if (badText) line += `, with ${badText}`;
    else if (goodText) line += `, with ${goodText}`;
  }

  if (isLast && end.result) {
    const ending = end.ending?.toLowerCase() ?? "";
    let finish = "";
    if (end.result === "win") finish = endPct >= 60 ? "and you finished it" : "and you still won";
    else if (end.result === "draw") finish = "and it ended in a draw";
    else if (endPct >= 60) finish = ending === "timeout" ? "but your clock ran out" : "but it slipped away at the end";
    else finish = ending === "checkmate" ? "and you were checkmated" : ending === "timeout" ? "and your clock ran out" : ending === "resignation" ? "and you resigned" : "and you lost";
    line += `, ${finish}`;
  }
  return `${line}.`;
}
