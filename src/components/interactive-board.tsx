import React, { useState, useEffect } from "react";
import { Chess, type Square } from "chess.js";
import { cn } from "@/lib/utils";

// Unicode piece representation matching game-analysis-flow.tsx
const PIECE_SYMBOLS: Record<string, Record<string, string>> = {
  w: {
    p: "♙",
    n: "♘",
    b: "♗",
    r: "♖",
    q: "♕",
    k: "♔",
  },
  b: {
    p: "♟",
    n: "♞",
    b: "♝",
    r: "♜",
    q: "♛",
    k: "♚",
  },
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

export interface InteractiveBoardProps {
  /** The current position FEN. Changing this resets the board state. */
  fen: string;
  /** Callback fired when a legal move is played on the board. */
  onMove?: (move: {
    from: string;
    to: string;
    promotion?: string;
    san: string;
    uci: string;
  }) => void;
  /** Active board perspective: "white" or "black". Defaults to "white". */
  orientation?: "white" | "black";
  /** If true, makes the board read-only. */
  disabled?: boolean;
  /** Custom squares to highlight (e.g. last move squares or check square). */
  highlightedSquares?: string[];
  /** Optional custom className for the board container. */
  className?: string;
}

export function InteractiveBoard({
  fen,
  onMove,
  orientation = "white",
  disabled = false,
  highlightedSquares = [],
  className,
}: InteractiveBoardProps) {
  const [chess, setChess] = useState<Chess>(() => new Chess(fen));
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validDestinations, setValidDestinations] = useState<string[]>([]);

  // Sync state whenever the incoming FEN changes
  useEffect(() => {
    try {
      setChess(new Chess(fen));
    } catch (e) {
      console.error("Failed to load FEN in InteractiveBoard:", fen, e);
    }
    setSelectedSquare(null);
    setValidDestinations([]);
  }, [fen]);

  const handleSquareClick = (square: string) => {
    if (disabled) return;

    // Toggle selection off if clicking the selected square again
    if (selectedSquare === square) {
      setSelectedSquare(null);
      setValidDestinations([]);
      return;
    }

    // Execute move if clicking a valid destination
    if (validDestinations.includes(square) && selectedSquare) {
      try {
        const moveOptions = {
          from: selectedSquare,
          to: square,
          promotion: "q", // default promotion to queen for simplicity
        };

        const tempChess = new Chess(chess.fen());
        const moveResult = tempChess.move(moveOptions);

        setChess(tempChess);
        setSelectedSquare(null);
        setValidDestinations([]);

        if (onMove) {
          onMove({
            from: selectedSquare,
            to: square,
            promotion: "q",
            san: moveResult.san,
            uci: moveResult.from + moveResult.to + (moveResult.promotion || ""),
          });
        }
      } catch (e) {
        console.error("Invalid move attempted in InteractiveBoard:", e);
      }
      return;
    }

    // Otherwise, select the clicked piece if it belongs to the side to move
    const piece = chess.get(square as Square);
    if (piece && piece.color === chess.turn()) {
      setSelectedSquare(square);
      const moves = chess.moves({ square: square as Square, verbose: true });
      setValidDestinations(moves.map((m) => m.to));
    } else {
      setSelectedSquare(null);
      setValidDestinations([]);
    }
  };

  const files = orientation === "black" ? [...FILES].reverse() : FILES;
  const ranks = orientation === "black" ? [...RANKS].reverse() : RANKS;

  return (
    <div
      className={cn(
        "relative aspect-square w-full max-w-md rounded-lg overflow-hidden border-2 border-ink shadow-sheet bg-ink select-none",
        className,
      )}
    >
      <div className="grid grid-cols-8 grid-rows-8 gap-0 h-full w-full">
        {ranks.map((rank, rIdx) =>
          files.map((file, cIdx) => {
            const square = `${file}${rank}`;
            const isDark = (rIdx + cIdx) % 2 === 1;
            const piece = chess.get(square as Square);
            const isSelected = selectedSquare === square;
            const isValidDest = validDestinations.includes(square);
            const isHighlighted = highlightedSquares.includes(square);

            // Label positioning
            const isLeftmost = cIdx === 0;
            const isBottommost = rIdx === 7;

            const colorSymbols = piece ? PIECE_SYMBOLS[piece.color] : null;

            return (
              <div
                key={square}
                data-square={square}
                onClick={() => handleSquareClick(square)}
                className={cn(
                  "relative flex items-center justify-center cursor-pointer text-4xl sm:text-5xl transition-colors duration-150",
                  isDark ? "bg-[#4b7399]" : "bg-[#eae9d2]",
                  isHighlighted && "bg-[#d0dd55]/70",
                  isSelected &&
                    "ring-4 ring-inset ring-evergreen-bright/60 bg-[#cdd26a]",
                  isValidDest &&
                    "after:absolute after:h-4 after:w-4 after:rounded-full after:bg-evergreen-bright/40",
                  disabled && "cursor-default",
                )}
              >
                {/* Piece representation */}
                {piece && colorSymbols && (
                  <span
                    className={cn(
                      "z-10 transition-transform duration-100 transform active:scale-95",
                      piece.color === "w"
                        ? "text-paper filter drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
                        : "text-black",
                    )}
                  >
                    {colorSymbols[piece.type] || ""}
                  </span>
                )}

                {/* Coordinate Labels: Rank numbers on the leftmost column */}
                {isLeftmost && (
                  <span
                    className={cn(
                      "absolute top-0.5 left-1 font-mono text-[9px] font-semibold opacity-60 leading-none",
                      isDark ? "text-[#eae9d2]" : "text-[#4b7399]",
                    )}
                  >
                    {rank}
                  </span>
                )}

                {/* Coordinate Labels: File letters on the bottom row */}
                {isBottommost && (
                  <span
                    className={cn(
                      "absolute bottom-0.5 right-1 font-mono text-[9px] font-semibold opacity-60 leading-none",
                      isDark ? "text-[#eae9d2]" : "text-[#4b7399]",
                    )}
                  >
                    {file}
                  </span>
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
