import { describe, expect, it } from "vitest";
import { describeEnding } from "./ending";

describe("describeEnding", () => {
  it("says who resigned or flagged", () => {
    expect(describeEnding("win", "resigned").long).toBe("Opponent resigned");
    expect(describeEnding("loss", "resigned").long).toBe("You resigned");
    expect(describeEnding("loss", "timeout")).toEqual({ short: "Timeout", long: "You ran out of time", by: "you" });
    expect(describeEnding("win", "checkmated").long).toBe("You checkmated them");
  });
  it("names draws", () => {
    expect(describeEnding("draw", "repetition")).toEqual({ short: "Repetition", long: "Draw by repetition", by: null });
    expect(describeEnding("draw", "stalemate").short).toBe("Stalemate");
    expect(describeEnding("draw", "agreed").short).toBe("Agreement");
  });
});
