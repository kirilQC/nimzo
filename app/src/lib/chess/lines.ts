/**
 * Formats a SAN line with move numbers. `firstPly` is the ply number the first
 * move will have once played (1 = White's first move).
 * e.g. firstPly 9, ["Bxf7+", "Kxf7", "Nxe5+"] -> "5. Bxf7+ Kxf7 6. Nxe5+"
 *      firstPly 10, ["Qxg2", "Rf1"] -> "5... Qxg2 6. Rf1"
 */
export function formatLine(firstPly: number, sans: string[]): string {
  return sans
    .map((san, i) => {
      const ply = firstPly + i;
      const no = Math.ceil(ply / 2);
      const white = ply % 2 === 1;
      if (white) return `${no}. ${san}`;
      return i === 0 ? `${no}... ${san}` : san;
    })
    .join(" ");
}
