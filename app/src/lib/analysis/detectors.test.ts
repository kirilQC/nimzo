import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  forkTargets,
  gamePhase,
  hangingPieces,
  isForkMove,
  lineHasBackRankMate,
  lineHasMate,
  materialBalance,
} from "./detectors";
import { buildFacts, type PositionInput } from "./facts";

describe("hangingPieces", () => {
  it("finds an undefended piece under attack", () => {
    // White bishop on c4 attacked by the black rook on c8, nothing defends it.
    expect(hangingPieces("2r3k1/8/8/8/2B5/8/8/6K1 w - - 0 1", "w")).toEqual(["c4"]);
  });
  it("finds a piece attacked by something cheaper even if defended", () => {
    // White knight e5 defended by d4 pawn but attacked by the d6 pawn.
    expect(hangingPieces("6k1/8/3p4/4N3/3P4/8/8/6K1 w - - 0 1", "w")).toEqual(["e5"]);
  });
  it("ignores defended pieces attacked by equal or higher value", () => {
    // White knight e5 defended by d4, attacked by the black rook on e8.
    expect(hangingPieces("4r1k1/8/8/4N3/3P4/8/8/6K1 w - - 0 1", "w")).toEqual([]);
  });
});

describe("forks", () => {
  it("sees a knight fork of king and rook", () => {
    expect(forkTargets("r3k3/2N5/8/8/8/8/8/4K3 b - - 0 1", "c7").sort()).toEqual(["a8", "e8"]);
  });
  it("recognises a forking move from the position before", () => {
    expect(isForkMove("r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1", "Nc7+")).toBe(true);
    expect(isForkMove("r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1", "Nd4")).toBe(false);
    expect(isForkMove("r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1", "Qh5")).toBe(false); // illegal -> false
  });
});

describe("mates", () => {
  it("detects a back-rank mate", () => {
    expect(lineHasBackRankMate("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", ["Ra8#"], "b")).toBe(true);
  });
  it("does not call a non-back-rank mate back rank", () => {
    // Scholar's-mate style: queen mates on f7, black king on e8 (back rank) but the mating piece is on f7.
    const fen = "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";
    expect(lineHasBackRankMate(fen, ["Qxf7#"], "b")).toBe(false);
    expect(lineHasMate(fen, ["Qxf7#"])).toBe(true);
  });
});

describe("phase and material", () => {
  it("classifies phases", () => {
    expect(gamePhase("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")).toBe("opening");
    expect(gamePhase("6k1/8/8/8/8/8/8/R5K1 w - - 0 40")).toBe("endgame");
    expect(gamePhase("r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP2BPPP/R2QKB1R w KQ - 0 15")).toBe("middlegame");
  });
  it("counts material from one side", () => {
    expect(materialBalance("6k1/8/8/8/8/8/8/R5K1 w - - 0 1", "w")).toBe(5);
    expect(materialBalance("6k1/8/8/8/8/8/8/R5K1 w - - 0 1", "b")).toBe(-5);
  });
});

describe("buildFacts on the Blackburne–Shilling fixture", () => {
  const pgn = readFileSync(new URL("../chess/__fixtures__/blunder.pgn", import.meta.url), "utf8");
  // Engine output stubbed for the critical moment: 5.Nxf7?? Qxg2 wins.
  const positions: PositionInput[] = Array.from({ length: 15 }, (_, ply) => ({
    ply,
    eval_cp: ply < 9 ? 60 : -700,
    eval_mate: null,
    classification: ply === 9 ? "blunder" : ply === 0 ? null : "good",
    best_move_san: ply === 9 ? "Bxf7+" : ply === 10 ? "Qxg2" : null,
    pv_san: ply === 9 ? ["Bxf7+", "Ke7", "Nxd4"] : ply === 10 ? ["Qxg2", "Rf1", "Qxe4+", "Be2", "Nf3#"] : null,
    multipv: null,
  }));
  const facts = buildFacts({ pgn, myColor: "white", positions });

  it("builds one facts object for the flagged move", () => {
    expect(facts).toHaveLength(1);
    const f = facts[0]!;
    expect(f).toMatchObject({ ply: 9, move_number: 5, san: "Nxf7", classification: "blunder", side: "white" });
    expect(f.engine_best.san).toBe("5. Bxf7+");
    expect(f.opponent_best_reply.san).toBe("5... Qxg2");
    expect(f.opponent_best_reply.line).toBe("5... Qxg2 6. Rf1 Qxe4+ 7. Be2 Nf3#");
    expect(f.move).toEqual({ piece: "knight", capture: true, check: false, castle: false });
    expect(f.previous_moves.map((m) => m.move)).toEqual(["3... Nd4", "4. Nxe5", "4... Qg5"]);
  });

  it("detects the mating threat and that the punishment is not a back-rank mate", () => {
    const d = facts[0]!.detectors;
    expect(d.allowed_mate_threat).toBe(true);
    expect(d.back_rank).toBe(false);
    expect(d.missed_mate).toBe(false);
    expect(d.punishment_captures_moved_piece).toBe(false);
  });
});
