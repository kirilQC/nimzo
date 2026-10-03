import { describe, expect, it } from "vitest";
import { ACCURACY_FIT, formatScore, gameAccuracy, judgeMove, moveAccuracy, scoreToCp, whiteWinPct, winPct } from "./math";
import { parseBestMove, parseInfo, toWhitePerspective } from "./uci";

describe("winPct (Lichess)", () => {
  it("is 50 at equality and symmetric", () => {
    expect(winPct(0)).toBe(50);
    expect(winPct(300) + winPct(-300)).toBeCloseTo(100, 10);
  });
  it("matches known values", () => {
    expect(winPct(100)).toBeCloseTo(59.1, 1);
    expect(winPct(300)).toBeCloseTo(75.1, 1);
  });
  it("clamps to ±1000 and treats mate as ±1000", () => {
    expect(winPct(5000)).toBe(winPct(1000));
    expect(scoreToCp({ mate: 3 })).toBe(1000);
    expect(scoreToCp({ mate: -1 })).toBe(-1000);
    expect(whiteWinPct({ mate: -2 })).toBeCloseTo(winPct(-1000), 10);
  });
});

describe("moveAccuracy (fitted to chess.com)", () => {
  it("is ~100 for no loss and falls with the win% drop", () => {
    expect(moveAccuracy(60, 60)).toBeCloseTo(99.9999, 3);
    expect(moveAccuracy(60, 70)).toBe(100); // improving is clamped
    expect(moveAccuracy(60, 50)).toBeCloseTo(103.1668 * Math.exp(-ACCURACY_FIT.b * 10) - 3.1669, 6);
    expect(moveAccuracy(90, 0)).toBe(0);
  });
  it("power-averages over moves, so bad moves weigh more than in a plain mean", () => {
    expect(gameAccuracy([100, 100])).toBeCloseTo(100, 6);
    const g = gameAccuracy([100, 50])!;
    expect(g).toBeLessThan(75);
    expect(g).toBeGreaterThan(50);
    expect(gameAccuracy([])).toBeNull();
  });
});

describe("judgeMove thresholds", () => {
  // White to move at +0 (50%). Drops measured in winning chances: 0.1 = 5 points.
  // Thresholds 8 / 12 / 30 points ≈ 0.9 / 1.3 / 3.8 pawns from equality.
  const judge = (afterCp: number, playedBest = false) =>
    judgeMove({ before: { cp: 0 }, after: { cp: afterCp }, mover: "w", playedBest, deliversMate: false });

  it("classifies by drop size", () => {
    expect(judge(-10).classification).toBe("good");
    expect(judge(0, true).classification).toBe("best");
    expect(judge(-60).classification).toBe("good"); // ~5.5 points
    expect(judge(-100).classification).toBe("inaccuracy"); // ~9.1 points
    expect(judge(-200).classification).toBe("mistake"); // ~17.5 points
    expect(judge(-400).classification).toBe("blunder"); // ~31.5 points
  });

  it("measures from the mover's side when Black moves", () => {
    const j = judgeMove({ before: { cp: 0 }, after: { cp: 400 }, mover: "b", playedBest: false, deliversMate: false });
    expect(j.classification).toBe("blunder");
    expect(j.winBefore).toBe(50);
  });

  it("treats small changes in a won position as minor", () => {
    const j = judgeMove({ before: { cp: 900 }, after: { cp: 700 }, mover: "w", playedBest: false, deliversMate: false });
    expect(j.classification).toBe("good");
  });

  it("flags a missed forced mate as a blunder even if still winning", () => {
    const j = judgeMove({ before: { mate: 2 }, after: { cp: 950 }, mover: "w", playedBest: false, deliversMate: false });
    expect(j.missedMate).toBe(true);
    expect(j.classification).toBe("blunder");
  });

  it("does not flag the mating move itself", () => {
    const j = judgeMove({ before: { mate: 1 }, after: { cp: 0 }, mover: "w", playedBest: true, deliversMate: true });
    expect(j.missedMate).toBe(false);
    expect(j.classification).toBe("best");
  });

  it("does not flag a shorter or equal mate as missed", () => {
    const j = judgeMove({ before: { mate: 3 }, after: { mate: 2 }, mover: "w", playedBest: true, deliversMate: false });
    expect(j.missedMate).toBe(false);
  });
});

describe("UCI parsing", () => {
  it("parses cp and mate info lines", () => {
    const l = parseInfo("info depth 16 seldepth 21 multipv 2 score cp -34 nodes 123 nps 1 hashfull 3 tbhits 0 time 50 pv e7e5 g1f3 b8c6");
    expect(l).toEqual({ multipv: 2, depth: 16, score: { cp: -34 }, pv: ["e7e5", "g1f3", "b8c6"] });
    expect(parseInfo("info depth 9 score mate 3 pv d1h5 g7g6 h5f7")!.score).toEqual({ mate: 3 });
  });
  it("ignores bound and pv-less lines", () => {
    expect(parseInfo("info depth 10 score cp 20 lowerbound pv e2e4")).toBeNull();
    expect(parseInfo("info depth 10 currmove e2e4 currmovenumber 1")).toBeNull();
    expect(parseInfo("info string NNUE evaluation enabled")).toBeNull();
  });
  it("flips to White's perspective", () => {
    expect(toWhitePerspective({ cp: 50 }, "b")).toEqual({ cp: -50 });
    expect(toWhitePerspective({ mate: 2 }, "b")).toEqual({ mate: -2 });
    expect(toWhitePerspective({ cp: 50 }, "w")).toEqual({ cp: 50 });
  });
  it("reads bestmove", () => {
    expect(parseBestMove("bestmove e2e4 ponder e7e5")).toBe("e2e4");
    expect(parseBestMove("bestmove (none)")).toBeNull();
  });
  it("formats scores", () => {
    expect(formatScore({ cp: 120 })).toBe("+1.2");
    expect(formatScore({ cp: -240 })).toBe("−2.4");
    expect(formatScore({ mate: -2 })).toBe("#−2");
    expect(formatScore({ cp: -2 })).toBe("0.0");
    expect(formatScore({ cp: 4 })).toBe("0.0");
  });
});
