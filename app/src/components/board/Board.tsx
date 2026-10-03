"use client";

import { Chessboard, type ChessboardOptions } from "react-chessboard";

const LIGHT = "#EAD7B5";
const DARK = "#A9784F";
const HL_LIGHT = "#E3B66A";
const HL_DARK = "#C08A3E";

function isDarkSquare(square: string): boolean {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return (file + rank) % 2 === 0;
}

export type BoardProps = {
  fen: string;
  orientation?: "white" | "black";
  lastMove?: { from: string; to: string } | null;
  options?: Partial<ChessboardOptions>;
  label?: string;
};

/** Wood-toned board with last-move highlighting. */
export function Board({ fen, orientation = "white", lastMove, options, label = "Chess board" }: BoardProps) {
  const squareStyles: Record<string, React.CSSProperties> = {};
  if (lastMove) {
    for (const sq of [lastMove.from, lastMove.to]) {
      squareStyles[sq] = { backgroundColor: isDarkSquare(sq) ? HL_DARK : HL_LIGHT };
    }
  }
  return (
    <div role="img" aria-label={label} className="rounded-[6px] border-[6px] border-walnut bg-walnut">
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          allowDragging: false,
          showAnimations: true,
          animationDurationInMs: 150,
          lightSquareStyle: { backgroundColor: LIGHT },
          darkSquareStyle: { backgroundColor: DARK },
          lightSquareNotationStyle: { color: DARK, fontWeight: 600 },
          darkSquareNotationStyle: { color: LIGHT, fontWeight: 600 },
          squareStyles,
          ...options,
        }}
      />
    </div>
  );
}
