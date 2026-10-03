import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CAUSE_KNOWLEDGE, COACHING_CORE, SECTIONS, TAG_KNOWLEDGE, knowledgeFor, openingSections, section } from "./index";
import { TRAPS, trapInGame } from "./traps";
import { TAGS, ROOT_CAUSES_V2 } from "@/lib/tags/catalog";

describe("knowledge base", () => {
  it("keeps every line of the source document", () => {
    const src = readFileSync(new URL("../../../../knowledge/nimzo-knowledge-base.md", import.meta.url), "utf8").replace(/\r\n/g, "\n");
    const body = SECTIONS.map((s) => s.text).join("\n");
    const lost = src.split("\n").filter((l) => l.trim() && !/^#{1,4}\s/.test(l) && !body.includes(l.trim()));
    expect(lost).toEqual([]);
  });
  it("links every tag and cause to sections that exist", () => {
    for (const t of TAGS) {
      expect(TAG_KNOWLEDGE[t.id], `tag ${t.id} has no knowledge link`).toBeDefined();
      for (const id of TAG_KNOWLEDGE[t.id]!) expect(section(id), `${t.id} -> ${id}`).toBeDefined();
    }
    for (const r of ROOT_CAUSES_V2) if (r.id !== "unclear") expect(CAUSE_KNOWLEDGE[r.id], r.id).toBeDefined();
    for (const ids of Object.values(CAUSE_KNOWLEDGE)) for (const id of ids) expect(section(id)).toBeDefined();
    for (const id of COACHING_CORE) expect(section(id)).toBeDefined();
  });
  it("finds openings and ranks knowledge for a set of tags", () => {
    expect(openingSections("Italian Game: Blackburne Shilling Gambit")).toEqual(["6.5.1"]);
    expect(openingSections("Caro-Kann Defense")).toEqual(["6.6.3"]);
    const k = knowledgeFor({ tags: ["allowed_knight_fork", "hung_minor"], budget: 6000 });
    expect(k.ids[0]).toBe("3.5");
    expect(k.ids).toContain("4.1");
    expect(k.text.length).toBeLessThanOrEqual(6500);
  });
  it("reads the opening traps from the document and spots them in games", () => {
    expect(TRAPS.length).toBeGreaterThanOrEqual(15);
    expect(trapInGame("e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7#".split(" "))).toMatchObject({ trap: { name: "Scholar's mate" }, ply: 6 });
    expect(trapInGame("e4 e5 Nf3 Nc6 Bc4 Nd4 Nxe5 Qg5 Nxf7 Qxg2".split(" "))).toMatchObject({ trap: { name: "Blackburne Shilling" }, ply: 9 });
    expect(trapInGame("e4 e5 Nf3 Nc6".split(" "))).toBeNull();
  });
});

describe("knowledge search", () => {
  it("finds the right section for a question", async () => {
    const { searchKnowledge } = await import("./index");
    expect(searchKnowledge("how do I stop getting back rank mated?")).toContain("5.1");
    expect(searchKnowledge("what is a zwischenzug")[0]).toBe("4.9");
    expect(searchKnowledge("when should I trade pieces")).toContain("7.17");
  });
});
