import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DIMENSIONS, MOTIFS, motifLabel, taxonomyRows } from "./taxonomy";
import { taxonomySql } from "../../../scripts/gen-taxonomy-sql";

describe("taxonomy", () => {
  it("has unique ids within each dimension", () => {
    for (const list of Object.values(DIMENSIONS)) {
      const ids = list.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("stays under Jev's 255-option cardinality limit per choice set", () => {
    for (const list of Object.values(DIMENSIONS)) expect(list.length).toBeLessThan(255);
  });

  it("has the 22 motifs from the brief, with labels", () => {
    expect(MOTIFS).toHaveLength(22);
    expect(motifLabel("hanging_piece_after_capture")).toBe("Hanging piece after a capture");
  });

  it("namespaces DB ids so 'opening' (type) and 'opening' (phase) don't collide", () => {
    const ids = taxonomyRows().map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("mistake_type:opening");
    expect(ids).toContain("phase:opening");
  });

  it("matches the committed seed migration (run `npm run gen:taxonomy` if this fails)", () => {
    const committed = readFileSync(
      new URL("../../../supabase/migrations/20261003000002_taxonomy_seed.sql", import.meta.url),
      "utf8",
    );
    expect(committed.replace(/\r\n/g, "\n")).toBe(taxonomySql());
  });
});
