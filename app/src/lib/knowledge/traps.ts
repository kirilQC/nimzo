import { section } from "./index";

/**
 * Opening traps, read from the knowledge base itself (section 6.4's trap table,
 * plus Légal's mate in 5.13 and Noah's Ark in 4.14), so the list grows when the
 * document does. A game "falls into" a trap when its moves match the trap line up
 * to the move marked ?? (or the first ? if there's no ??). The side that played
 * that move is the victim.
 */
export type Trap = { name: string; moves: string[]; victimIndex: number; lesson: string; section: string };

const clean = (tok: string) => tok.replace(/^\d+\.(\.\.)?/, "").replace(/^\.\.\./, "").trim();

function parseLine(line: string): { moves: string[]; victimIndex: number } | null {
  const toks = line
    .replace(/\(.*?\)/g, " ")
    .split(/\s+/)
    .map(clean)
    .filter((t) => t && /^(O-O(-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?)[+#]?[!?]*$/.test(t));
  if (toks.length < 3) return null;
  const strong = toks.findIndex((t) => t.includes("??"));
  const weak = toks.findIndex((t) => /[^!]\?$|^[^?]*\?$/.test(t) && !t.includes("?!") && !t.includes("??"));
  const victimIndex = strong >= 0 ? strong : weak;
  if (victimIndex < 0) return null;
  return { moves: toks.map((t) => t.replace(/[!?]/g, "")), victimIndex };
}

function loadTraps(): Trap[] {
  const out: Trap[] = [];
  const table = section("6.4")?.text ?? "";
  for (const row of table.split("\n")) {
    const cells = row.split("|").map((c) => c.trim());
    if (cells.length < 4 || !/\d\./.test(cells[2] ?? "")) continue;
    const parsed = parseLine(cells[2]!);
    if (parsed) out.push({ name: cells[1]!, ...parsed, lesson: cells[3] ?? "", section: "6.4" });
  }
  const legal = /\*\*Moves\*\*:\s*(1\.e4[^\n]*)/.exec(section("5.13")?.text ?? "")?.[1];
  if (legal) {
    const p = parseLine(legal);
    if (p) out.push({ name: "Légal trap", ...p, lesson: "Pins can be broken if mate follows", section: "5.13" });
  }
  const noah = /(1\.e4 e5 2\.Nf3 Nc6 3\.Bb5 a6[^\n]*?traps)/.exec(section("4.14")?.text ?? "")?.[1];
  if (noah) {
    const p = parseLine(noah.replace(/traps$/, ""));
    if (p) out.push({ name: "Noah's Ark trap", ...p, lesson: "Pawn chains can trap bishops", section: "4.14" });
  }
  // The same trap can appear twice (e.g. Légal in the table and in 5.13): keep the first.
  const seen = new Set<string>();
  return out.filter((t) => {
    const key = t.moves.slice(0, t.victimIndex + 1).join(" ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const TRAPS: Trap[] = loadTraps();

const norm = (san: string) => san.replace(/[+#!?]/g, "");

/** The trap this game fell into, if any: which ply was the victim's move. */
export function trapInGame(sans: string[]): { trap: Trap; ply: number } | null {
  for (const trap of TRAPS) {
    const n = trap.victimIndex + 1;
    if (sans.length < n) continue;
    let ok = true;
    for (let i = 0; i < n; i++) if (norm(sans[i]!) !== norm(trap.moves[i]!)) ok = false;
    if (ok) return { trap, ply: n };
  }
  return null;
}
