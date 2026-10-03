import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { enPrise, kingShield, movePattern, pawnStructure, pinsAgainst } from "./board";
import { notationIn } from "@/lib/coach/guard";

describe("movePattern", () => {
  it("sees a knight fork of king and rook", () => {
    // White knight jumps to c7 forking the king on e8 and rook on a8.
    const p = movePattern("r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1", "d5c7")!;
    expect(p.check).toBe(true);
    expect(p.fork).toEqual(expect.arrayContaining(["rook", "king"]));
  });
  it("sees a pin of a knight to the king", () => {
    const p = movePattern("4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1", "f1b5")!;
    expect(p.pin).toBe(true);
  });
  it("does not call a pawn pinned to a rook a pin", () => {
    const p = movePattern("7r/7p/8/8/8/8/8/4KQ1k w - - 0 1", "f1f3");
    expect(p?.pin).toBe(false);
  });
  it("flags a free capture", () => {
    const p = movePattern("4k3/8/8/3n4/8/8/8/3QK3 w - - 0 1", "d1d5")!;
    expect(p.captures).toBe("knight");
    expect(p.captures_free).toBe(true);
  });
  it("returns null for an illegal move", () => {
    expect(movePattern("4k3/8/8/8/8/8/8/4K3 w - - 0 1", "e1e3")).toBeNull();
  });
});

describe("board facts", () => {
  it("finds pieces that can be won", () => {
    const c = new Chess("4k3/8/8/3n4/8/8/8/3QK3 b - - 0 1");
    expect(enPrise(c, "b").map((p) => p.sq)).toEqual(["d5"]);
  });
  it("finds a pin against a side", () => {
    expect(pinsAgainst(new Chess("4k3/8/2n5/1B6/8/8/8/4K3 b - - 0 1"), "b")).toHaveLength(1);
  });
  it("counts the king's pawn shield and pawn weaknesses", () => {
    const c = new Chess("4k3/8/8/8/8/2P5/2P2PPP/6K1 w - - 0 1");
    expect(kingShield(c, "w")).toBe(3);
    expect(pawnStructure(c, "w")).toMatchObject({ doubled: 1, isolated: 2 });
  });
});

describe("notation guard", () => {
  it("spots moves and squares but not plain words", () => {
    expect(notationIn("You left your knight on e5 and Qxg8+ won")).toEqual(["e5", "Qxg8"]);
    expect(notationIn("On move 18 your queen could take their rook with check.")).toEqual([]);
  });
});
