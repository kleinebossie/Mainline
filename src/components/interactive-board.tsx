import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square, type Color, type PieceSymbol } from "chess.js";
import { cn } from "@/lib/utils";
import { ChessPiece } from "@/components/chess-piece";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;

// Board colours live on the analysis sheet: cool drafting paper light squares + a muted
// evergreen dark square that echoes the app's single accent (not a stock blue board).
const LIGHT_SQUARE = "#e8e9da";
const DARK_SQUARE = "#6f8a7d";

// Movement past this many pixels turns a press into a drag (vs a click-to-move tap).
const DRAG_THRESHOLD = 5;

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
  /** Custom squares to highlight (e.g. a hint or last-move squares). */
  highlightedSquares?: string[];
  /** Optional custom className for the board container. */
  className?: string;
}

interface DragState {
  from: string;
  type: PieceSymbol;
  color: Color;
  dests: string[];
  xPct: number;
  yPct: number;
  over: string | null;
}

export function InteractiveBoard({
  fen,
  onMove,
  orientation = "white",
  disabled = false,
  highlightedSquares = [],
  className,
}: InteractiveBoardProps) {
  const [chess, setChess] = useState<Chess>(() => safeChess(fen));
  const [selected, setSelected] = useState<string | null>(null);
  const [legalDests, setLegalDests] = useState<string[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);
  const pressRef = useRef<{ square: string; x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const dragInfoRef = useRef<{ from: string; dests: string[] } | null>(null);
  const suppressClickRef = useRef(false);

  // Re-sync whenever the incoming FEN changes (new puzzle, parent-driven move, reset).
  useEffect(() => {
    setChess(safeChess(fen));
    setSelected(null);
    setLegalDests([]);
    setDrag(null);
    pressRef.current = null;
    draggingRef.current = false;
    dragInfoRef.current = null;
  }, [fen]);

  const files = useMemo(
    () => (orientation === "black" ? [...FILES].reverse() : [...FILES]),
    [orientation],
  );
  const ranks = useMemo(
    () => (orientation === "black" ? [...RANKS].reverse() : [...RANKS]),
    [orientation],
  );

  const turn = chess.turn();
  const inCheck = chess.isCheck();
  const kingSquare = useMemo(
    () => (inCheck ? findKing(chess, turn) : null),
    [chess, inCheck, turn],
  );

  const destsFor = useCallback(
    (square: string): string[] => {
      try {
        return chess
          .moves({ square: square as Square, verbose: true })
          .map((m) => m.to);
      } catch {
        return [];
      }
    },
    [chess],
  );

  const playMove = useCallback(
    (from: string, to: string) => {
      try {
        const next = safeChess(chess.fen());
        const result = next.move({ from, to, promotion: "q" });
        setChess(next);
        setSelected(null);
        setLegalDests([]);
        onMove?.({
          from,
          to,
          promotion: "q",
          san: result.san,
          uci: result.from + result.to + (result.promotion || ""),
        });
      } catch {
        // Illegal move (e.g. dropped on a non-destination) — ignore.
      }
    },
    [chess, onMove],
  );

  const squareFromPoint = useCallback(
    (clientX: number, clientY: number): string => {
      const rect = boardRef.current?.getBoundingClientRect();
      if (!rect) return "";
      const col = clamp(Math.floor(((clientX - rect.left) / rect.width) * 8), 0, 7);
      const row = clamp(Math.floor(((clientY - rect.top) / rect.height) * 8), 0, 7);
      return `${files[col]}${ranks[row]}`;
    },
    [files, ranks],
  );

  // Drag handling lives on `window` (not pointer capture): capture would re-target the
  // synthesised click to the board, breaking per-square click-to-move (and keyboard/e2e).
  // Click-to-move stays the authoritative path; a drag past the threshold takes over.
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const press = pressRef.current;
      if (!press) return;

      if (!draggingRef.current) {
        const moved =
          Math.abs(e.clientX - press.x) + Math.abs(e.clientY - press.y);
        if (moved < DRAG_THRESHOLD) return;
        const piece = chess.get(press.square as Square);
        if (!piece) {
          pressRef.current = null;
          return;
        }
        draggingRef.current = true;
        dragInfoRef.current = { from: press.square, dests: destsFor(press.square) };
        setSelected(null);
        setLegalDests([]);
        setDrag({
          from: press.square,
          type: piece.type,
          color: piece.color,
          dests: dragInfoRef.current.dests,
          ...pointPct(e.clientX, e.clientY, boardRef.current),
          over: press.square,
        });
        return;
      }

      setDrag((d) =>
        d
          ? {
              ...d,
              ...pointPct(e.clientX, e.clientY, boardRef.current),
              over: squareFromPoint(e.clientX, e.clientY),
            }
          : d,
      );
    };

    const onPointerUp = (e: PointerEvent) => {
      if (draggingRef.current) {
        const info = dragInfoRef.current;
        const target = squareFromPoint(e.clientX, e.clientY);
        if (info && info.dests.includes(target)) playMove(info.from, target);
        suppressClickRef.current = true; // swallow the trailing click after a drag
      }
      pressRef.current = null;
      draggingRef.current = false;
      dragInfoRef.current = null;
      setDrag(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [chess, destsFor, playMove, squareFromPoint]);

  const handlePointerDown = (e: React.PointerEvent, square: string) => {
    if (disabled || e.button !== 0) return;
    const piece = chess.get(square as Square);
    // Only own pieces begin a press/drag; everything else is left to click-to-move.
    if (!piece || piece.color !== turn) return;
    pressRef.current = { square, x: e.clientX, y: e.clientY };
  };

  const handleClick = (square: string) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (disabled) return;

    if (selected === square) {
      setSelected(null);
      setLegalDests([]);
      return;
    }
    if (selected && legalDests.includes(square)) {
      playMove(selected, square);
      return;
    }
    const piece = chess.get(square as Square);
    if (piece && piece.color === turn) {
      setSelected(square);
      setLegalDests(destsFor(square));
    } else {
      setSelected(null);
      setLegalDests([]);
    }
  };

  const activeFrom = drag?.from ?? selected;
  const activeDests = drag ? drag.dests : selected ? legalDests : [];

  return (
    <div
      className={cn(
        "relative aspect-square w-full max-w-md select-none overflow-hidden rounded-lg border-2 border-ink shadow-sheet",
        disabled && "opacity-95",
        className,
      )}
    >
      <div
        ref={boardRef}
        className="grid h-full w-full grid-cols-8 grid-rows-8 touch-none"
      >
        {ranks.map((rank, rIdx) =>
          files.map((file, cIdx) => {
            const square = `${file}${rank}`;
            const isDark = (rIdx + cIdx) % 2 === 1;
            const piece = chess.get(square as Square);
            const isOwn = !!piece && piece.color === turn;
            const isOrigin = activeFrom === square;
            const isDragOrigin = drag?.from === square;
            const isDest = activeDests.includes(square);
            const isHighlighted = highlightedSquares.includes(square);
            const isOver = drag?.over === square && isDest;
            const isCheckSquare = kingSquare === square;

            return (
              <button
                type="button"
                key={square}
                data-square={square}
                aria-label={ariaLabel(square, piece)}
                disabled={disabled}
                onPointerDown={(e) => handlePointerDown(e, square)}
                onClick={() => handleClick(square)}
                style={{ backgroundColor: isDark ? DARK_SQUARE : LIGHT_SQUARE }}
                className={cn(
                  "relative flex items-center justify-center p-0",
                  "focus:outline-none focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-evergreen-bright",
                  !disabled && isOwn && "cursor-grab",
                  drag && "cursor-grabbing",
                )}
              >
                {/* hint / last-move wash */}
                {isHighlighted && (
                  <span className="absolute inset-0 bg-amber/35" aria-hidden />
                )}
                {/* king-in-check glow */}
                {isCheckSquare && (
                  <span
                    className="absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(circle, hsl(var(--clay) / 0.85) 0%, hsl(var(--clay) / 0.35) 45%, transparent 72%)",
                    }}
                    aria-hidden
                  />
                )}
                {/* selected / drag origin */}
                {isOrigin && (
                  <span
                    className="absolute inset-0 bg-evergreen/25 ring-[3px] ring-inset ring-evergreen-bright/80 transition-opacity motion-reduce:transition-none"
                    aria-hidden
                  />
                )}
                {/* drag hover target ring */}
                {isOver && !isOrigin && (
                  <span
                    className="absolute inset-0 ring-[3px] ring-inset ring-evergreen-bright/70"
                    aria-hidden
                  />
                )}

                {/* piece (hidden on its own square while being dragged) */}
                {piece && !isDragOrigin && (
                  <ChessPiece
                    type={piece.type}
                    color={piece.color}
                    className="relative z-10 h-[86%] w-[86%]"
                  />
                )}

                {/* legal-move markers */}
                {isDest &&
                  (piece ? (
                    <span
                      className="absolute inset-[7%] z-[5] rounded-full border-[0.35rem] border-evergreen/45"
                      aria-hidden
                    />
                  ) : (
                    <span
                      className="absolute z-[5] h-[30%] w-[30%] rounded-full bg-evergreen/45"
                      aria-hidden
                    />
                  ))}

                {/* coordinate labels along the inner edges */}
                {cIdx === 0 && (
                  <span
                    className="pointer-events-none absolute left-[3px] top-[1px] font-mono text-[8px] font-semibold leading-none sm:text-[10px]"
                    style={{ color: isDark ? LIGHT_SQUARE : DARK_SQUARE }}
                    aria-hidden
                  >
                    {rank}
                  </span>
                )}
                {rIdx === 7 && (
                  <span
                    className="pointer-events-none absolute bottom-[1px] right-[3px] font-mono text-[8px] font-semibold leading-none sm:text-[10px]"
                    style={{ color: isDark ? LIGHT_SQUARE : DARK_SQUARE }}
                    aria-hidden
                  >
                    {file}
                  </span>
                )}
              </button>
            );
          }),
        )}
      </div>

      {/* floating dragged piece */}
      {drag && (
        <div
          className="pointer-events-none absolute z-30 flex h-[12.5%] w-[12.5%] -translate-x-1/2 -translate-y-1/2 items-center justify-center"
          style={{ left: `${drag.xPct}%`, top: `${drag.yPct}%` }}
          aria-hidden
        >
          <ChessPiece
            type={drag.type}
            color={drag.color}
            className="h-[92%] w-[92%] drop-shadow-[0_6px_8px_rgba(0,0,0,0.35)]"
          />
        </div>
      )}
    </div>
  );
}

function safeChess(fen: string): Chess {
  try {
    return new Chess(fen);
  } catch (e) {
    console.error("InteractiveBoard: invalid FEN, falling back to start.", fen, e);
    return new Chess();
  }
}

function findKing(chess: Chess, color: Color): string | null {
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell && cell.type === "k" && cell.color === color) return cell.square;
    }
  }
  return null;
}

function pointPct(
  clientX: number,
  clientY: number,
  board: HTMLDivElement | null,
): { xPct: number; yPct: number } {
  const rect = board?.getBoundingClientRect();
  if (!rect) return { xPct: 50, yPct: 50 };
  return {
    xPct: clamp(((clientX - rect.left) / rect.width) * 100, 0, 100),
    yPct: clamp(((clientY - rect.top) / rect.height) * 100, 0, 100),
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

const PIECE_NAMES: Record<PieceSymbol, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

function ariaLabel(
  square: string,
  piece: { type: PieceSymbol; color: Color } | undefined | null,
): string {
  if (!piece) return `${square}, empty`;
  return `${square}, ${piece.color === "w" ? "white" : "black"} ${PIECE_NAMES[piece.type]}`;
}
