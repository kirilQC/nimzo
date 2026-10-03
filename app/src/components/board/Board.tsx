"use client";

import { Chessboard, type ChessboardOptions } from "react-chessboard";
import { BOARD_IMAGE, DARK_SQ, LIGHT_SQ, woodPieces } from "./pieces";
import { MoveIcon } from "./MoveIcon";
import type { LabelId } from "@/lib/analysis/labels";

const HIGHLIGHT = "rgba(255, 214, 77, 0.45)"; // last move, over the wood

export type BoardProps = {
  fen: string;
  orientation?: "white" | "black";
  lastMove?: { from: string; to: string } | null;
  badge?: { square: string; label: LabelId } | null; // move label shown in the corner of a square
  options?: Partial<ChessboardOptions>;
  label?: string;
};

/** Wooden board and pieces, last-move highlight, and the move's label badge. */
export function Board({ fen, orientation = "white", lastMove, badge, options, label = "Chess board" }: BoardProps) {
  const squareStyles: Record<string, React.CSSProperties> = {};
  if (lastMove) for (const sq of [lastMove.from, lastMove.to]) squareStyles[sq] = { backgroundColor: HIGHLIGHT };
  return (
    <div
      role="img"
      aria-label={label}
      className="overflow-hidden rounded-[4px]"
      style={{ backgroundImage: `url(${BOARD_IMAGE})`, backgroundSize: "100% 100%" }}
    >
      {/* Squares are transparent over one wood texture; light/dark lines up from either side (a8 and h1 are both light). */}
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          allowDragging: false,
          showAnimations: true,
          animationDurationInMs: 150,
          pieces: woodPieces,
          lightSquareStyle: { backgroundColor: "transparent" },
          darkSquareStyle: { backgroundColor: "transparent" },
          lightSquareNotationStyle: { color: DARK_SQ, fontWeight: 700 },
          darkSquareNotationStyle: { color: LIGHT_SQ, fontWeight: 700 },
          squareStyles,
          squareRenderer: badge
            ? ({ square, children }) => (
                <div style={{ position: "relative", width: "100%", height: "100%" }}>
                  {children}
                  {square === badge.square && (
                    <span style={{ position: "absolute", top: "-10%", right: "-10%", width: "46%", height: "46%", zIndex: 20, pointerEvents: "none", filter: "drop-shadow(0 1px 1px rgba(0,0,0,.35))" }}>
                      <MoveIcon label={badge.label} size="100%" />
                    </span>
                  )}
                </div>
              )
            : undefined,
          ...options,
        }}
      />
    </div>
  );
}
