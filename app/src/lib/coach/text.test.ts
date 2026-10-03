import { describe, expect, it } from "vitest";
import { bannedIn, longSentences, noDashes } from "./text";

describe("Arthur's house style", () => {
  it("removes every kind of dash", () => {
    expect(noDashes("You were ahead — then it slipped – sadly - again.")).toBe("You were ahead, then it slipped, sadly, again.");
    expect(noDashes("a back-rank weakness and half-open file")).toBe("a back rank weakness and half open file");
    expect(noDashes("moves 18-20")).toBe("moves 18 to 20");
    expect(noDashes("No dash here.")).toBe("No dash here.");
  });
  it("flags run-on sentences", () => {
    expect(longSentences("Short one. " + "word ".repeat(30) + "end.")).toHaveLength(1);
    expect(longSentences("You castled early. Good.")).toHaveLength(0);
  });
  it("flags banned phrasing", () => {
    expect(bannedIn("Kiril, this was one of your toughest games.")).toEqual(expect.arrayContaining(["starts with the player's name", "harsh ranking of the game"]));
    expect(bannedIn("You had the edge for the first half.")).toEqual([]);
  });
});
