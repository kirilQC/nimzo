"use client";

import { Chessboard } from "react-chessboard";

/** Small static board (no coordinates, no interaction) for cards and lesson previews. */
export function MiniBoard({ fen, orientation = "white", label = "Chess position" }: { fen: string; orientation?: "white" | "black"; label?: string }) {
  return (
    <div role="img" aria-label={label} className="rounded-[4px] border-4 border-walnut bg-walnut">
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          allowDragging: false,
          showNotation: false,
          showAnimations: false,
          lightSquareStyle: { backgroundColor: "#EAD7B5" },
          darkSquareStyle: { backgroundColor: "#A9784F" },
        }}
      />
    </div>
  );
}
