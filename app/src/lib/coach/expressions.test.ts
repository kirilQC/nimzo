import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EXPRESSIONS, QA_EXPRESSIONS, expressionForGame, expressionForMistake, expressionForSession, type Expression } from "./expressions";

describe("Arthur's expressions", () => {
  it("has an image for every expression", () => {
    for (const e of Object.keys(EXPRESSIONS)) {
      expect(existsSync(fileURLToPath(new URL(`../../../public/brand/arthur/${e}.webp`, import.meta.url))), e).toBe(true);
    }
  });

  it("reacts to mistakes by severity and context", () => {
    const blunders: Expression[] = ["shocked", "oops", "disappointed"];
    expect(blunders).toContain(expressionForMistake({ severity: "blunder", ply: 9, clockMs: 400_000 }));
    expect(expressionForMistake({ severity: "blunder", ply: 9, clockMs: 400_000, winBefore: 85 })).toBe("disappointed");
    expect(expressionForMistake({ severity: "mistake", ply: 20, clockMs: 30_000 })).toBe("worried");
    expect(expressionForMistake({ severity: "inaccuracy", ply: 3, clockMs: null, missedMate: true })).toBe("questioning");
    expect(["skeptical", "puzzled", "pondering"]).toContain(expressionForMistake({ severity: "inaccuracy", ply: 4, clockMs: null }));
  });

  it("matches the game and session mood", () => {
    expect(expressionForGame("win", 85)).toBe("celebrating");
    expect(expressionForGame("loss", 40)).toBe("sympathetic");
    expect(expressionForGame("draw", 70)).toBe("shrug");
    expect(expressionForSession(3, 1)).toBe("thumbs_up");
    expect(expressionForSession(1, 3)).toBe("sympathetic");
  });

  it("only offers Claude expressions that fit an answer", () => {
    expect(QA_EXPRESSIONS).not.toContain("sleepy");
    expect(QA_EXPRESSIONS).toContain("eureka");
  });
});
