/**
 * Guardrail for the golden rule: every concrete move Claude mentions must come
 * from the engine facts. Bare squares ("the pawn on e5") are allowed; piece
 * moves, captures, promotions and castling are checked.
 */
const MOVE_RE = /\b(O-O-O|O-O|[KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|[a-h]x[a-h][1-8](?:=[QRBN])?|[a-h][18]=[QRBN])[+#]?/g;

export function normalizeSan(san: string): string {
  return san.replace(/[+#!?]/g, "").trim();
}

/** All SAN moves appearing in a set of (numbered) lines like "5. Bxf7+ Kxf7 6. Nxe5+". */
export function sanSet(lines: (string | null | undefined)[]): Set<string> {
  const out = new Set<string>();
  for (const line of lines) {
    if (!line) continue;
    for (const tok of line.split(/\s+/)) {
      const t = normalizeSan(tok.replace(/^\d+\.(\.\.)?/, ""));
      if (t) out.add(t);
    }
  }
  return out;
}

/** Moves mentioned in `text` that are not in `allowed`. */
export function unknownMoves(text: string, allowed: Set<string>): string[] {
  const bad = new Set<string>();
  for (const m of text.matchAll(MOVE_RE)) {
    const san = normalizeSan(m[1]!);
    if (!allowed.has(san)) bad.add(san);
  }
  return [...bad];
}

/** Chess notation in prose: SAN moves, castling, or bare square names. Arthur's beginner notes must have none. */
const NOTATION_RE = /\b(?:O-O(?:-O)?|[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h]x[a-h][1-8]|[a-h][1-8])\b/g;

export function notationIn(text: string): string[] {
  return [...new Set([...text.matchAll(NOTATION_RE)].map((m) => m[0]))];
}
