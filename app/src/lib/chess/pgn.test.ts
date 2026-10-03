import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { clockFromComment, formatClock, incrementMs, initialClockMs, parseClock, pgnToPositions } from "./pgn";

const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

describe("parseClock", () => {
  it("parses h:mm:ss with tenths", () => {
    expect(parseClock("0:04:58.3")).toBe(298_300);
    expect(parseClock("1:00:00")).toBe(3_600_000);
  });
  it("parses m:ss", () => {
    expect(parseClock("2:05")).toBe(125_000);
  });
  it("rejects junk", () => {
    expect(parseClock("abc")).toBeNull();
    expect(parseClock("")).toBeNull();
  });
});

describe("clockFromComment", () => {
  it("finds %clk among other annotations", () => {
    expect(clockFromComment("[%clk 0:00:07.0] [%timestamp 12]")).toBe(7_000);
    expect(clockFromComment("no clock here")).toBeNull();
    expect(clockFromComment(undefined)).toBeNull();
  });
});

describe("time control", () => {
  it("reads base and increment", () => {
    expect(initialClockMs("180+2")).toBe(180_000);
    expect(incrementMs("180+2")).toBe(2_000);
    expect(initialClockMs("600")).toBe(600_000);
    expect(incrementMs("600")).toBe(0);
    expect(initialClockMs("1/259200")).toBeNull();
  });
});

describe("pgnToPositions", () => {
  it("parses the blunder fixture into plies with clocks", () => {
    const g = pgnToPositions(fixture("blunder.pgn"));
    expect(g.plies).toHaveLength(14);
    expect(g.headers.White).toBe("NimzoUser");
    expect(g.plies[0]).toMatchObject({ ply: 1, san: "e4", uci: "e2e4", color: "w", clockMs: 597_000, timeSpentMs: 3_000 });
    expect(g.plies[8]!.san).toBe("Nxf7");
    expect(g.plies[13]!.san).toBe("Nf3#");
    expect(g.startFen).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    expect(g.plies[1]!.fenBefore).toBe(g.plies[0]!.fenAfter);
  });

  it("adds the increment back when computing time spent", () => {
    const g = pgnToPositions(fixture("time-scramble.pgn"));
    const black = g.plies.filter((p) => p.color === "b");
    // first black move: 180s base, spent 2.5s, +2s increment => clock 179.5s, spent 2.5s
    expect(black[0]!.clockMs).toBe(179_500);
    expect(black[0]!.timeSpentMs).toBe(2_500);
    // the scramble: black finishes with under 10 seconds
    expect(black.at(-1)!.clockMs!).toBeLessThan(10_000);
  });

  it("parses the clean game to mate", () => {
    const g = pgnToPositions(fixture("clean-win.pgn"));
    expect(g.plies.at(-1)!.san).toBe("Rd8#");
    expect(g.plies.every((p) => p.clockMs !== null)).toBe(true);
  });
});

describe("formatClock", () => {
  it("formats", () => {
    expect(formatClock(65_000)).toBe("1:05");
    expect(formatClock(3_725_000)).toBe("1:02:05");
    expect(formatClock(null)).toBe("—");
  });
});
