import hashes from "./book.json";

/**
 * Opening book: positions from the Lichess openings list (CC0), stored as
 * 32-bit hashes (scripts/gen-book.mjs). Collisions are negligible at this size.
 */
const BOOK = new Set<number>(hashes as number[]);

/** Placement, side to move, castling, en passant: the parts that define an opening position. */
const epd = (fen: string) => fen.split(" ").slice(0, 4).join(" ");

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function isBookPosition(fen: string): boolean {
  return BOOK.has(fnv1a(epd(fen)));
}
