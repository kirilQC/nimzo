// Builds app/src/lib/chess/book.json: 32-bit hashes of every position reached in the
// Lichess openings list (lichess-org/chess-openings, CC0). A move is "Book" while the
// game stays inside these positions.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(new URL("../app/package.json", import.meta.url));
const { Chess } = require("chess.js");

// Keep in sync with app/src/lib/chess/book.ts
const epd = (fen) => fen.split(" ").slice(0, 4).join(" ");
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
const set = new Set();
for (const f of "abcde") for (const line of readFileSync(new URL(`./openings-src/${f}.tsv`, import.meta.url), "utf8").split("\n").slice(1)) {
  const pgn = line.split("\t")[2];
  if (!pgn) continue;
  const c = new Chess();
  for (const san of pgn.replace(/\d+\.\s*/g, "").trim().split(/\s+/)) { c.move(san); set.add(fnv1a(epd(c.fen()))); }
}
writeFileSync(new URL("../app/src/lib/chess/book.json", import.meta.url), JSON.stringify([...set].sort((a, b) => a - b)));
console.log(set.size, "book positions");
