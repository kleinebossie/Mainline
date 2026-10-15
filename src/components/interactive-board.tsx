"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { cn } from "@/lib/utils";

// Controlled board: the parent owns the FEN; this component derives legal moves and notation.

// Board materials come from the palette (planning/DESIGN.md): neutral squares, and blue
// biro only where the reader has acted or can act.
const LIGHT_SQUARE = "var(--board-light, #e6e8e1)";
const DARK_SQUARE = "var(--board-dark, #6e8479)";
const SELECT_FILL = "rgba(29, 64, 192, 0.34)";
const SELECT_RING = "inset 0 0 0 3px rgba(29, 64, 192, 0.9)";
const HINT_FILL = "rgba(154, 100, 8, 0.4)";
const DEST_DOT =
  "radial-gradient(circle, rgba(28, 33, 31, 0.3) 17%, transparent 19%)";
const CAPTURE_RING = "inset 0 0 0 4px rgba(28, 33, 31, 0.32)";
const HOVER_RING = "inset 0 0 0 3px rgba(29, 64, 192, 0.45)";
const CHECK_FILL =
  "radial-gradient(circle, rgba(174, 49, 32, 0.85) 0%, rgba(174, 49, 32, 0.3) 50%, transparent 72%)";

/** Canonical responsive measure for every chessboard in the app. */
export const BOARD_SIZE_CLASS = "w-full max-w-[32rem]";

export interface BoardMove {
  from: string;
  to: string;
  promotion?: string;
  san: string;
  uci: string;
}

export interface InteractiveBoardProps {
  fen: string;
  onMove?: (move: BoardMove) => void;
  orientation?: "white" | "black";
  disabled?: boolean;
  highlightedSquares?: string[];
  className?: string;
  id?: string;
  showEvalBar?: boolean;
  evalCp?: number | null;
  showLegalMoveDots?: boolean;
  allowArrows?: boolean;
  allowHover?: boolean;
  showNotation?: boolean;
}

export function InteractiveBoard({
  fen,
  onMove,
  orientation = "white",
  disabled = false,
  highlightedSquares = [],
  className,
  id = "interactive-board",
  showEvalBar = false,
  evalCp = null,
  showLegalMoveDots = true,
  allowArrows = true,
  allowHover = true,
  showNotation = true,
}: InteractiveBoardProps) {
  // Keep legality and SAN derivation synchronized with the controlled FEN.
  const game = useMemo(() => new Chess(fen), [fen]);
  const turn = game.turn();

  const [selected, setSelected] = useState<Square | null>(null);
  const [hovered, setHovered] = useState<Square | null>(null);
  // react-chessboard measures the DOM to size itself; only mount it on the client to
  // avoid SSR/hydration mismatches. The aspect-square wrapper reserves the space meanwhile.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Reset transient UI whenever the position changes (new puzzle, accepted move, reset).
  useEffect(() => {
    setSelected(null);
    setHovered(null);
  }, [fen]);

  const legalDests = useMemo(() => {
    if (!selected) return [] as string[];
    try {
      return game
        .moves({ square: selected, verbose: true })
        .map((m) => m.to as string);
    } catch {
      return [];
    }
  }, [game, selected]);

  // Try moves on a clone; the parent decides whether to advance the controlled FEN.
  const attemptMove = useCallback(
    (from: string, to: string): boolean => {
      if (disabled) return false;
      const probe = new Chess(fen);
      let legal;
      try {
        legal = probe
          .moves({ square: from as Square, verbose: true })
          .find((m) => m.to === to);
      } catch {
        legal = undefined;
      }
      if (!legal) return false;
      const promotion = legal.promotion ? "q" : undefined; // auto-queen
      let made;
      try {
        made = probe.move({ from, to, promotion });
      } catch {
        return false;
      }
      setSelected(null);
      onMove?.({
        from,
        to,
        promotion: made.promotion,
        san: made.san,
        uci: made.from + made.to + (made.promotion ?? ""),
      });
      return true;
    },
    [disabled, fen, onMove],
  );

  const ownPieceAt = useCallback(
    (square: string): boolean => {
      const p = game.get(square as Square);
      return !!p && p.color === turn;
    },
    [game, turn],
  );

  const handleSquareClick = useCallback(
    ({ square }: { square: string }) => {
      if (disabled) return;
      if (selected) {
        if (square === selected) {
          setSelected(null);
          return;
        }
        if (legalDests.includes(square)) {
          attemptMove(selected, square);
          return;
        }
      }
      setSelected(ownPieceAt(square) ? (square as Square) : null);
    },
    [disabled, selected, legalDests, attemptMove, ownPieceAt],
  );

  const handlePieceDrop = useCallback(
    ({
      sourceSquare,
      targetSquare,
    }: {
      sourceSquare: string;
      targetSquare: string | null;
    }): boolean => {
      if (!targetSquare) return false;
      attemptMove(sourceSquare, targetSquare);
      // Always false: the board is controlled by `fen`, so it re-renders to whatever
      // stable or transient position the parent decides.
      return false;
    },
    [attemptMove],
  );

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    for (const sq of highlightedSquares) styles[sq] = { background: HINT_FILL };

    if (allowHover && hovered && !selected && ownPieceAt(hovered)) {
      styles[hovered] = { ...styles[hovered], boxShadow: HOVER_RING };
    }

    if (showLegalMoveDots) {
      for (const dest of legalDests) {
        const capture = !!game.get(dest as Square);
        styles[dest] = {
          ...styles[dest],
          background: capture ? undefined : DEST_DOT,
          boxShadow: capture ? CAPTURE_RING : styles[dest]?.boxShadow,
        };
      }
    }

    if (selected) {
      styles[selected] = {
        ...styles[selected],
        background: SELECT_FILL,
        boxShadow: SELECT_RING,
      };
    }

    if (game.inCheck()) {
      const king = findKing(game, turn);
      if (king) styles[king] = { ...styles[king], background: CHECK_FILL };
    }
    return styles;
  }, [
    highlightedSquares,
    allowHover,
    hovered,
    selected,
    ownPieceAt,
    showLegalMoveDots,
    legalDests,
    game,
    turn,
  ]);

  const options = useMemo(
    () => ({
      id,
      position: fen,
      boardOrientation: orientation,
      allowDragging: !disabled,
      allowDrawingArrows: allowArrows && !disabled,
      showAnimations: true,
      animationDurationInMs: 180,
      showNotation,
      darkSquareStyle: { backgroundColor: DARK_SQUARE },
      lightSquareStyle: { backgroundColor: LIGHT_SQUARE },
      boardStyle: {
        borderRadius: "6px",
        boxShadow: "inset 0 0 0 1px rgba(28, 33, 31, 0.16)",
      },
      squareStyles,
      onSquareClick: handleSquareClick,
      onPieceDrop: handlePieceDrop,
      canDragPiece: ({ piece }: { piece: { pieceType: string } }) =>
        !disabled && piece.pieceType[0] === turn,
      onMouseOverSquare: allowHover
        ? ({ square }: { square: string }) => setHovered(square as Square)
        : undefined,
      onMouseOutSquare: allowHover ? () => setHovered(null) : undefined,
    }),
    [
      id,
      fen,
      orientation,
      disabled,
      allowArrows,
      allowHover,
      showNotation,
      squareStyles,
      handleSquareClick,
      handlePieceDrop,
      turn,
    ],
  );

  return (
    <div
      className={cn("flex items-stretch gap-2.5", className, BOARD_SIZE_CLASS)}
    >
      {showEvalBar && evalCp != null && <EvalBar cp={evalCp} />}
      <div className="relative aspect-square min-w-0 flex-1 select-none overflow-hidden rounded-lg">
        {mounted ? (
          <Chessboard options={options} />
        ) : (
          <div className="h-full w-full rounded-lg border border-rule bg-sheet" />
        )}
      </div>
    </div>
  );
}

/** A slim Stockfish eval bar (White share grows from the bottom). Off by default. */
function EvalBar({ cp }: { cp: number }) {
  const whiteShare = 0.5 + 0.5 * Math.tanh(cp / 400); // smooth win-probability-ish map
  return (
    <div
      className="bg-ink relative w-2 shrink-0 overflow-hidden rounded-[1px]"
      aria-hidden
    >
      <div
        className="bg-sheet absolute inset-x-0 bottom-0"
        style={{ height: `${Math.round(whiteShare * 100)}%` }}
      />
    </div>
  );
}

function findKing(game: Chess, color: "w" | "b"): string | null {
  for (const row of game.board()) {
    for (const cell of row) {
      if (cell && cell.type === "k" && cell.color === color) return cell.square;
    }
  }
  return null;
}
