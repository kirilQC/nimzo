import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";

/**
 * Board geometry for the feature extractor: attacks, en-prise pieces, pins,
 * skewers, discovered attacks, king shelter, development and pawn structure.
 * Pure chess.js, no engine. Every helper is deliberately conservative: it would
 * rather miss a pattern than report one that isn't on the board.
 */

export const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
export const NAME: Record<PieceSymbol, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
export const other = (c: Color): Color => (c === "w" ? "b" : "w");

export const SQUARES: Square[] = (() => {
  const out: Square[] = [];
  for (const r of "87654321") for (const f of "abcdefgh") out.push(`${f}${r}` as Square);
  return out;
})();

const file = (sq: string) => sq.charCodeAt(0) - 97;
const rank = (sq: string) => Number(sq[1]) - 1;
const at = (f: number, r: number): Square | null => (f < 0 || f > 7 || r < 0 || r > 7 ? null : (`${String.fromCharCode(97 + f)}${r + 1}` as Square));

export type Piece = { sq: Square; type: PieceSymbol; color: Color };

export function piecesOf(c: Chess, color?: Color): Piece[] {
  const out: Piece[] = [];
  for (const sq of SQUARES) {
    const p = c.get(sq);
    if (p && (!color || p.color === color)) out.push({ sq, type: p.type, color: p.color });
  }
  return out;
}

export function kingSquare(c: Chess, color: Color): Square | null {
  return piecesOf(c, color).find((p) => p.type === "k")?.sq ?? null;
}

/** Squares the piece on `sq` attacks (pseudo-legal; ignores pins). */
export function attacksFrom(c: Chess, sq: Square): Square[] {
  const p = c.get(sq);
  if (!p) return [];
  return SQUARES.filter((t) => t !== sq && c.attackers(t, p.color).includes(sq));
}

/**
 * Pieces of `color` that the opponent can win: attacked and undefended, or
 * attacked by something cheaper. Kings excluded. `minValue` 1 includes pawns.
 */
export function enPrise(c: Chess, color: Color, minValue = 3): Piece[] {
  return piecesOf(c, color).filter((p) => {
    if (p.type === "k" || VALUE[p.type] < minValue) return false;
    const attackers = c.attackers(p.sq, other(color));
    if (!attackers.length) return false;
    const defenders = c.attackers(p.sq, color);
    const cheapest = Math.min(...attackers.map((a) => VALUE[c.get(a)!.type]));
    return !defenders.length || cheapest < VALUE[p.type];
  });
}

const DIRS = {
  rook: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  bishop: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
} as const;

function slides(type: PieceSymbol): readonly (readonly [number, number])[] {
  if (type === "r") return DIRS.rook;
  if (type === "b") return DIRS.bishop;
  if (type === "q") return [...DIRS.rook, ...DIRS.bishop];
  return [];
}

/** Walks from a slider along each ray and reports the first two pieces it meets. */
function rays(c: Chess, from: Square) {
  const p = c.get(from)!;
  const out: { first: Piece; second: Piece | null }[] = [];
  for (const [df, dr] of slides(p.type)) {
    let f = file(from) + df, r = rank(from) + dr;
    let first: Piece | null = null;
    while (true) {
      const sq = at(f, r);
      if (!sq) break;
      const q = c.get(sq);
      if (q) {
        const piece = { sq, type: q.type, color: q.color };
        if (!first) first = piece;
        else {
          out.push({ first, second: piece });
          first = null;
          break;
        }
      }
      f += df;
      r += dr;
    }
    if (first) out.push({ first, second: null });
  }
  return out;
}

export type Pin = { pinned: Piece; to: Piece; by: Piece; absolute: boolean };

/** Pieces of `color` pinned by an enemy slider to their king or to a more valuable piece. */
export function pinsAgainst(c: Chess, color: Color): Pin[] {
  const out: Pin[] = [];
  for (const s of piecesOf(c, other(color))) {
    if (!["b", "r", "q"].includes(s.type)) continue;
    for (const { first, second } of rays(c, s.sq)) {
      if (!second || first.color !== color || second.color !== color || first.type === "k") continue;
      if (second.type === "k" || VALUE[second.type] > VALUE[first.type]) out.push({ pinned: first, to: second, by: s, absolute: second.type === "k" });
    }
  }
  return out;
}

/** Enemy slider lines where a valuable piece of `color` (or the king) stands in front of a lesser one. */
export function skewersAgainst(c: Chess, color: Color): { front: Piece; back: Piece; by: Piece }[] {
  const out: { front: Piece; back: Piece; by: Piece }[] = [];
  for (const s of piecesOf(c, other(color))) {
    if (!["b", "r", "q"].includes(s.type)) continue;
    for (const { first, second } of rays(c, s.sq)) {
      if (!second || first.color !== color || second.color !== color || second.type === "k") continue;
      const frontVal = VALUE[first.type];
      if ((first.type === "k" || frontVal > VALUE[second.type]) && frontVal > VALUE[s.type] - 1 && VALUE[second.type] >= 3) out.push({ front: first, back: second, by: s });
    }
  }
  return out;
}

/** Enemy pieces (or the king) the piece on `sq` attacks that are worth more than it, or hang to it. */
export function forkTargets(c: Chess, sq: Square): Piece[] {
  const p = c.get(sq);
  if (!p) return [];
  return attacksFrom(c, sq)
    .map((t) => ({ t, q: c.get(t) }))
    .filter(({ q }) => q && q.color !== p.color)
    .filter(({ t, q }) => q!.type === "k" || VALUE[q!.type] > VALUE[p.type] || (!c.attackers(t, q!.color).length && VALUE[q!.type] >= 3))
    .map(({ t, q }) => ({ sq: t, type: q!.type, color: q!.color }));
}

export type MovePattern = {
  fork: string[]; // names of forked pieces
  pin: boolean; // the moved piece pins something
  skewer: boolean;
  discovered: boolean; // moving uncovered an attack by another piece on something valuable
  discovered_check: boolean;
  double_check: boolean;
  check: boolean;
  mate: boolean;
  captures: string | null; // name of the captured piece
  captures_free: boolean; // the captured piece was undefended or worth more than the capturer
  promotes: boolean;
  attacks_queen: boolean;
  traps_piece: string | null; // an enemy piece now attacked with no safe square
};

/** What a move does tactically, from the position before it. Returns null if the move is illegal. */
export function movePattern(fenBefore: string, move: string): MovePattern | null {
  const c = new Chess(fenBefore);
  const me = c.turn(), them = other(me);
  const beforeAttacks = new Map<Square, Square[]>();
  for (const p of piecesOf(c, me)) if (["b", "r", "q"].includes(p.type)) beforeAttacks.set(p.sq, attacksFrom(c, p.sq));
  const capturedDefended = (() => {
    try {
      const probe = new Chess(fenBefore);
      const m = probe.move(move.length >= 4 && /^[a-h][1-8][a-h][1-8]/.test(move) ? { from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] } : move);
      if (!m.captured) return null;
      return { defended: new Chess(fenBefore).attackers(m.to as Square, them).length > 0, value: VALUE[m.captured], mover: VALUE[m.piece] };
    } catch {
      return null;
    }
  })();
  let mv;
  try {
    mv = c.move(move.length >= 4 && /^[a-h][1-8][a-h][1-8]/.test(move) ? { from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] } : move);
  } catch {
    return null;
  }
  const to = mv.to as Square;
  const forked = forkTargets(c, to).filter((t) => t.color === them);
  // Only pins of a knight or better count; a pawn pinned to a rook is rarely the point.
  const pin = pinsAgainst(c, them).some((p) => p.by.sq === to && VALUE[p.pinned.type] >= 3);
  const skewer = skewersAgainst(c, them).some((s) => s.by.sq === to);

  // Discovered: another of my sliders now attacks a valuable enemy piece it didn't before.
  let discovered = false, discoveredCheck = false;
  for (const [sq, before] of beforeAttacks) {
    if (sq === mv.from) continue;
    const now = attacksFrom(c, sq);
    const slider = c.get(sq)!;
    for (const t of now) {
      if (before.includes(t)) continue;
      const q = c.get(t);
      // Only a real threat: the king, a piece worth more than the attacker, or an undefended piece.
      if (q && q.color === them && (q.type === "k" || (VALUE[q.type] >= 3 && (VALUE[q.type] > VALUE[slider.type] || !c.attackers(t, them).length)))) {
        discovered = true;
        if (q.type === "k") discoveredCheck = true;
      }
    }
  }
  const king = kingSquare(c, them);
  const checkers = king ? c.attackers(king, me) : [];

  // Trapped: an enemy piece (knight or better) attacked by something cheaper, with every flight square unsafe.
  let traps: string | null = null;
  // In check, every piece's moves are restricted, so nothing looks free to move: skip.
  if (!c.inCheck()) for (const p of piecesOf(c, them)) {
    if (p.type === "k" || p.type === "p" || VALUE[p.type] < 3) continue;
    const attackers = c.attackers(p.sq, me);
    if (!attackers.length || Math.min(...attackers.map((a) => VALUE[c.get(a)!.type])) >= VALUE[p.type]) continue;
    const swapped = new Chess(c.fen().replace(/ [wb] /, ` ${them} `));
    let escapes;
    try {
      escapes = swapped.moves({ square: p.sq, verbose: true });
    } catch {
      continue;
    }
    const safe = escapes.some((e) => {
      const t = new Chess(swapped.fen());
      t.move(e);
      return !t.attackers(e.to as Square, me).length || (e.captured !== undefined && VALUE[e.captured] >= VALUE[p.type]);
    });
    if (!safe) {
      traps = NAME[p.type];
      break;
    }
  }

  return {
    fork: forked.length >= 2 ? forked.map((f) => NAME[f.type]) : [],
    pin,
    skewer,
    discovered,
    discovered_check: discoveredCheck,
    double_check: checkers.length >= 2,
    check: c.inCheck(),
    mate: c.isCheckmate(),
    captures: mv.captured ? NAME[mv.captured] : null,
    captures_free: !!capturedDefended && (!capturedDefended.defended || capturedDefended.value > capturedDefended.mover),
    promotes: !!mv.promotion,
    attacks_queen: attacksFrom(c, to).some((t) => c.get(t)?.type === "q" && c.get(t)?.color === them),
    traps_piece: traps,
  };
}

/** Own pawns in the three files around the king, one or two ranks ahead. */
export function kingShield(c: Chess, color: Color): number {
  const k = kingSquare(c, color);
  if (!k) return 0;
  const dir = color === "w" ? 1 : -1;
  let n = 0;
  for (let df = -1; df <= 1; df++)
    for (const dr of [1, 2]) {
      const sq = at(file(k) + df, rank(k) + dr * dir);
      const p = sq ? c.get(sq) : null;
      if (p && p.type === "p" && p.color === color) n++;
    }
  return n;
}

/** Enemy pieces attacking any square next to the king. */
export function kingZoneAttackers(c: Chess, color: Color): number {
  const k = kingSquare(c, color);
  if (!k) return 0;
  const set = new Set<Square>();
  for (let df = -1; df <= 1; df++)
    for (let dr = -1; dr <= 1; dr++) {
      const sq = at(file(k) + df, rank(k) + dr);
      if (sq) for (const a of c.attackers(sq, other(color))) set.add(a);
    }
  return set.size;
}

export function isCastled(c: Chess, color: Color): boolean {
  const k = kingSquare(c, color);
  const back = color === "w" ? "1" : "8";
  return !!k && k[1] === back && ["g", "h", "c", "b"].includes(k[0]!);
}

const MINOR_HOME: Record<Color, Square[]> = { w: ["b1", "g1", "c1", "f1"], b: ["b8", "g8", "c8", "f8"] };

/** Knights and bishops no longer on their starting squares (and still on the board). */
export function developedMinors(c: Chess, color: Color): number {
  const home = MINOR_HOME[color];
  const minors = piecesOf(c, color).filter((p) => p.type === "n" || p.type === "b");
  return minors.filter((p) => !home.includes(p.sq)).length;
}

export function pawnStructure(c: Chess, color: Color) {
  const mine = piecesOf(c, color).filter((p) => p.type === "p");
  const theirs = piecesOf(c, other(color)).filter((p) => p.type === "p");
  const files = new Map<number, number>();
  for (const p of mine) files.set(file(p.sq), (files.get(file(p.sq)) ?? 0) + 1);
  let doubled = 0, isolated = 0, passed = 0;
  for (const [f, n] of files) {
    if (n > 1) doubled += n - 1;
    if (!files.has(f - 1) && !files.has(f + 1)) isolated += n;
  }
  for (const p of mine) {
    const f = file(p.sq), r = rank(p.sq);
    const blocked = theirs.some((t) => Math.abs(file(t.sq) - f) <= 1 && (color === "w" ? rank(t.sq) > r : rank(t.sq) < r));
    if (!blocked) passed++;
  }
  return { pawns: mine.length, doubled, isolated, passed };
}

/** Legal moves `color` would have if it were their turn. */
export function mobility(fen: string, color: Color): number {
  try {
    const parts = fen.split(" ");
    parts[1] = color;
    parts[3] = "-";
    return new Chess(parts.join(" ")).moves().length;
  } catch {
    return 0;
  }
}

/** Checks and captures available to the side to move (the "checks, captures, threats" scan). */
export function forcingMoves(fen: string): { checks: number; captures: number } {
  const c = new Chess(fen);
  let checks = 0, captures = 0;
  for (const m of c.moves({ verbose: true })) {
    if (m.san.includes("+") || m.san.includes("#")) checks++;
    if (m.captured) captures++;
  }
  return { checks, captures };
}

export function materialBalance(c: Chess, color: Color): number {
  let s = 0;
  for (const p of piecesOf(c)) if (p.type !== "k") s += p.color === color ? VALUE[p.type] : -VALUE[p.type];
  return s;
}

export function nonPawnMaterial(c: Chess): number {
  return piecesOf(c).reduce((s, p) => s + (p.type === "k" || p.type === "p" ? 0 : VALUE[p.type]), 0);
}

export function isOpenFile(c: Chess, f: number): boolean {
  for (let r = 0; r < 8; r++) if (c.get(at(f, r)!)?.type === "p") return false;
  return true;
}

export const sqFile = file;
export const sqRank = rank;
