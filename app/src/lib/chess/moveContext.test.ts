import { describe, expect, it } from "vitest";
import { moveContext } from "./moveContext";
import { isBookPosition } from "./book";

describe("moveContext", () => {
  it("spots a piece offered for nothing", () => {
    // White plays Bxh7+?? style: bishop takes a defended pawn next to the king.
    const fen = "r1bq1rk1/pppn1ppp/4pn2/3p4/1bPP4/2NBPN2/PP3PPP/R1BQK2R w KQ - 0 7";
    expect(moveContext(fen, "d3h7").sacrifice).toBe(true);
  });
  it("does not call a plain trade a sacrifice", () => {
    const fen = "rnbqkbnr/ppp2ppp/8/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3";
    expect(moveContext(fen, "f3e5").sacrifice).toBe(false); // knight takes a pawn, nothing hangs
  });
  it("counts legal moves", () => {
    expect(moveContext("7k/8/8/8/8/8/8/K7 b - - 0 1", "h8h7").legalMoves).toBe(3);
    expect(moveContext("7k/8/8/8/8/8/8/K5R1 b - - 0 1", "h8h7").legalMoves).toBe(1); // only Kh7
  });
});

describe("opening book", () => {
  it("knows the main lines", () => {
    expect(isBookPosition("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1")).toBe(true); // 1.e4
    expect(isBookPosition("rnbqkbnr/pppppppp/8/8/8/7P/PPPPPPP1/RNBQKBNR b KQkq - 0 1")).toBe(true); // 1.h3 is named too
    expect(isBookPosition("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")).toBe(false); // no move yet
    expect(isBookPosition("8/8/8/4k3/8/8/8/4K3 w - - 0 1")).toBe(false);
  });
});
