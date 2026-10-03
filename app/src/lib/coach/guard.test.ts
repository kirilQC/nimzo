import { describe, expect, it } from "vitest";
import { sanSet, unknownMoves } from "./guard";

describe("move guard", () => {
  const allowed = sanSet(["5. Bxf7+ Kxf7 6. Nxe5+", "5... Qxg2 6. Rf1 Qxe4+ 7. Be2 Nf3#", "Nxf7"]);

  it("accepts moves that are in the facts, with or without check marks", () => {
    expect(unknownMoves("Nxf7 grabbed a pawn, but Qxg2 hits the rook. The engine liked Bxf7+.", allowed)).toEqual([]);
    expect(unknownMoves("After 5... Qxg2 6. Rf1 Qxe4+ it is over.", allowed)).toEqual([]);
  });

  it("flags invented piece moves and captures", () => {
    expect(unknownMoves("Better was Qh5, hitting f7, or dxe5.", allowed)).toEqual(["Qh5", "dxe5"]);
  });

  it("ignores bare squares and castling that appears in the data", () => {
    expect(unknownMoves("The pawn on e5 and the f7 square were weak.", allowed)).toEqual([]);
    expect(unknownMoves("You should have played O-O.", allowed)).toEqual(["O-O"]);
    expect(unknownMoves("You should have played O-O.", sanSet(["7. O-O"]))).toEqual([]);
  });
});
