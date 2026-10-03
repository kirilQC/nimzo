"use client";

import { Chessboard } from "react-chessboard";
import { BOARD_IMAGE, woodPieces } from "./pieces";

/** Small static board (no coordinates, no interaction) for cards and lesson previews. */
export function MiniBoard({ fen, orientation = "white", label = "Chess position" }: { fen: string; orientation?: "white" | "black"; label?: string }) {
  return (
    <div role="img" aria-label={label} className="overflow-hidden rounded-[3px]" style={{ backgroundImage: `url(${BOARD_IMAGE})`, backgroundSize: "100% 100%" }}>
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          allowDragging: false,
          showNotation: false,
          showAnimations: false,
          pieces: woodPieces,
          lightSquareStyle: { backgroundColor: "transparent" },
          darkSquareStyle: { backgroundColor: "transparent" },
        }}
      />
    </div>
  );
}
