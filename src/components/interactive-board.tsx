"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { cn } from "@/lib/utils";

// Controlled board: the parent owns the FEN; this component derives legal moves and notation.

const LIGHT_SQUARE = "#e9e7d8";
const DARK_SQUARE = "#6f8a7d";
const SELECT_FILL = "rgba(111, 138, 125, 0.45)";
const SELECT_RING = "inset 0 0 0 3px rgba(47, 64, 57, 0.85)";
const HINT_FILL = "rgba(214, 158, 46, 0.5)";
const DEST_DOT =
  "radial-gradient(circle, rgba(35, 48, 43, 0.32) 17%, transparent 19%)";
const CAPTURE_RING = "inset 0 0 0 4px rgba(35, 48, 43, 0.32)";
const HOVER_RING = "inset 0 0 0 3px rgba(111, 138, 125, 0.6)";
const CHECK_FILL =
  "radial-gradient(circle, rgba(176, 58, 46, 0.85) 0%, rgba(176, 58, 46, 0.3) 50%, transparent 72%)";

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
      darkSquareStyle: { backgroundColor: DARK_SQUARE },
      lightSquareStyle: { backgroundColor: LIGHT_SQUARE },
      boardStyle: {
        borderRadius: "0.5rem",
        boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
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
      squareStyles,
      handleSquareClick,
      handlePieceDrop,
      turn,
    ],
  );

  return (
    <div
      className={cn("flex items-stretch gap-2", className, BOARD_SIZE_CLASS)}
    >
      {showEvalBar && evalCp != null && <EvalBar cp={evalCp} />}
      <div className="relative aspect-square min-w-0 flex-1 select-none overflow-hidden rounded-lg">
        {mounted ? (
          <Chessboard options={options} />
        ) : (
          <div className="h-full w-full rounded-lg border border-line bg-paper/40" />
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
      className="relative w-2 shrink-0 overflow-hidden rounded-sm border border-ink/20 bg-ink"
      aria-hidden
    >
      <div
        className="absolute inset-x-0 bottom-0 bg-paper"
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
