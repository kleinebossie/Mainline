import React from "react";
import { cn } from "@/lib/utils";
import {
  PIECE_ART_VIEWBOX,
  PIECE_PATHS,
  type PieceType,
} from "@/components/chess-piece-art";

// Two-tone piece palette. White pieces are warm ivory with a dark keyline; black pieces are
// near-black with a darker keyline — both stay legible on light *and* dark squares.
const WHITE_FILL = "#f6f4ea";
const WHITE_STROKE = "#1b1f24";
const BLACK_FILL = "#2b3138";
const BLACK_STROKE = "#0c0f13";

export interface ChessPieceProps {
  type: PieceType;
  color: "w" | "b";
  className?: string;
  title?: string;
}

export function ChessPiece({ type, color, className, title }: ChessPieceProps) {
  const isWhite = color === "w";
  return (
    <svg
      viewBox={PIECE_ART_VIEWBOX}
      role="img"
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn(
        "drop-shadow-[0_1.5px_0.5px_rgba(0,0,0,0.22)]",
        className,
      )}
      style={
        {
          "--pf": isWhite ? WHITE_FILL : BLACK_FILL,
          "--ps": isWhite ? WHITE_STROKE : BLACK_STROKE,
        } as React.CSSProperties
      }
    >
      <g
        strokeWidth={1.3}
        strokeLinejoin="round"
        strokeLinecap="round"
        dangerouslySetInnerHTML={{ __html: PIECE_PATHS[type] }}
      />
    </svg>
  );
}
