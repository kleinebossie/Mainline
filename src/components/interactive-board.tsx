"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { cn } from "@/lib/utils";
import { playCaptureSound, playCheckSound, playMoveSound } from "@/lib/sound";

// Controlled board: the parent owns the FEN.
// This component derives legal moves, plays chess sounds, and renders move feedback.

export type BoardThemeId = "sheet" | "wood" | "high-contrast" | "slate";

export interface BoardTheme {
  id: BoardThemeId;
  label: string;
  lightSquare: string;
  darkSquare: string;
  coordLight: string;
  coordDark: string;
}

export const BOARD_THEMES: Record<BoardThemeId, BoardTheme> = {
  sheet: {
    id: "sheet",
    label: "Sheet (default)",
    lightSquare: "var(--board-light, #E7ECE4)",
    darkSquare: "var(--board-dark, #7B9B8A)",
    coordLight: "var(--board-coord-light, #5E7A6B)",
    coordDark: "var(--board-coord-dark, #D2DAD0)",
  },
  wood: {
    id: "wood",
    label: "Warm wood",
    lightSquare: "#F0D9B5",
    darkSquare: "#B58863",
    coordLight: "#B58863",
    coordDark: "#F0D9B5",
  },
  "high-contrast": {
    id: "high-contrast",
    label: "High contrast",
    lightSquare: "#FFFFFF",
    darkSquare: "#2B2B2B",
    coordLight: "#000000",
    coordDark: "#FFFFFF",
  },
  slate: {
    id: "slate",
    label: "Slate",
    lightSquare: "#DEE3E6",
    darkSquare: "#8CA2AD",
    coordLight: "#8CA2AD",
    coordDark: "#DEE3E6",
  },
};

const SELECT_FILL = "rgba(46, 107, 80, 0.38)";
const SELECT_RING = "inset 0 0 0 3px rgba(46, 107, 80, 0.85)";
const HINT_FILL = "rgba(214, 158, 46, 0.5)";
const DEST_DOT =
  "radial-gradient(circle, rgba(21, 24, 27, 0.32) 17%, transparent 19%)";
const CAPTURE_RING = "inset 0 0 0 4px rgba(21, 24, 27, 0.32)";
const HOVER_RING = "inset 0 0 0 3px rgba(46, 107, 80, 0.6)";
const CHECK_FILL =
  "radial-gradient(circle, rgba(168, 69, 47, 0.85) 0%, rgba(168, 69, 47, 0.3) 50%, transparent 72%)";

/** Canonical responsive measure for every chessboard in the app. */
export const BOARD_SIZE_CLASS = "w-full max-w-[32rem]";

export interface BoardMove {
  from: string;
  to: string;
  promotion?: string;
  san: string;
  uci: string;
}

export interface BoardFeedback {
  square: string;
  kind: "correct" | "mistake";
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
  feedback?: BoardFeedback | null;
  boardTheme?: BoardThemeId;
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
  feedback = null,
  boardTheme,
}: InteractiveBoardProps) {
  const game = useMemo(() => new Chess(fen), [fen]);
  const turn = game.turn();

  const [selected, setSelected] = useState<Square | null>(null);
  const [hovered, setHovered] = useState<Square | null>(null);
  const [mounted, setMounted] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [storedTheme, setStoredTheme] = useState<BoardThemeId>("sheet");

  const prevFenRef = useRef(fen);
  const userMovedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handleMotion = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handleMotion);

    const savedTheme = window.localStorage.getItem(
      "mainline_board_theme",
    ) as BoardThemeId | null;
    if (savedTheme && savedTheme in BOARD_THEMES) {
      setStoredTheme(savedTheme);
    }

    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === "mainline_board_theme" &&
        e.newValue &&
        e.newValue in BOARD_THEMES
      ) {
        setStoredTheme(e.newValue as BoardThemeId);
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      mq.removeEventListener("change", handleMotion);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Play sound on position updates when not triggered by the player move.
  useEffect(() => {
    if (prevFenRef.current !== fen) {
      if (!userMovedRef.current && mounted) {
        try {
          const prevGame = new Chess(prevFenRef.current);
          const currGame = new Chess(fen);
          if (currGame.inCheck()) {
            playCheckSound();
          } else {
            const prevCount = prevGame.board().flat().filter(Boolean).length;
            const currCount = currGame.board().flat().filter(Boolean).length;
            if (currCount < prevCount) {
              playCaptureSound();
            } else {
              playMoveSound();
            }
          }
        } catch {
          // Safe no-op on invalid position string.
        }
      }
      userMovedRef.current = false;
      prevFenRef.current = fen;
    }
  }, [fen, mounted]);

  // Reset transient UI when position changes.
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
      const promotion = legal.promotion ? "q" : undefined;
      let made;
      try {
        made = probe.move({ from, to, promotion });
      } catch {
        return false;
      }

      // Mark move as user action and trigger sound.
      userMovedRef.current = true;
      if (probe.inCheck()) {
        playCheckSound();
      } else if (made.captured) {
        playCaptureSound();
      } else {
        playMoveSound();
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
      return Boolean(p && p.color === turn);
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
      return false;
    },
    [attemptMove],
  );

  const activeTheme = BOARD_THEMES[boardTheme ?? storedTheme] ?? BOARD_THEMES.sheet;

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    for (const sq of highlightedSquares) styles[sq] = { background: HINT_FILL };

    if (allowHover && hovered && !selected && ownPieceAt(hovered)) {
      styles[hovered] = { ...styles[hovered], boxShadow: HOVER_RING };
    }

    if (showLegalMoveDots) {
      for (const dest of legalDests) {
        const capture = Boolean(game.get(dest as Square));
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

    if (feedback) {
      const feedbackBg =
        feedback.kind === "correct"
          ? "var(--board-correct, rgba(46, 107, 80, 0.35))"
          : "var(--board-mistake, rgba(168, 69, 47, 0.35))";
      styles[feedback.square] = {
        ...styles[feedback.square],
        background: feedbackBg,
        transition: "background 120ms ease-out",
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
    feedback,
    game,
    turn,
  ]);

  const squareRenderer = useCallback(
    ({
      square,
      children,
    }: {
      square: string;
      children?: React.ReactNode;
    }) => {
      const isFeedback = feedback?.square === square;

      return (
        <div
          data-square={square}
          style={{
            width: "100%",
            height: "100%",
            position: "relative",
            ...squareStyles[square],
          }}
        >
          {children}
          {isFeedback && (
            <span
              data-testid={`board-move-badge-${feedback.kind}`}
              className={cn(
                "pointer-events-none absolute right-1 top-1 z-20 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full font-mono text-xs sm:text-sm font-bold text-white shadow-sm transition-opacity duration-120 animate-in fade-in",
                feedback.kind === "correct"
                  ? "bg-[var(--board-correct-solid,#2E6B50)] ring-1 ring-white/60"
                  : "bg-[var(--board-mistake-solid,#A8452F)] ring-1 ring-white/60",
              )}
              aria-label={
                feedback.kind === "correct" ? "Correct move" : "Mistake"
              }
            >
              {feedback.kind === "correct" ? "!" : "?"}
            </span>
          )}
        </div>
      );
    },
    [feedback, squareStyles],
  );

  const options = useMemo(
    () => ({
      id,
      position: fen,
      boardOrientation: orientation,
      allowDragging: !disabled,
      allowDrawingArrows: allowArrows && !disabled,
      showAnimations: !prefersReducedMotion,
      animationDurationInMs: prefersReducedMotion ? 0 : 150,
      showNotation,
      darkSquareStyle: { backgroundColor: activeTheme.darkSquare },
      lightSquareStyle: { backgroundColor: activeTheme.lightSquare },
      darkSquareNotationStyle: {
        color: activeTheme.coordDark,
        fontSize: "11px",
        fontWeight: "600",
      },
      lightSquareNotationStyle: {
        color: activeTheme.coordLight,
        fontSize: "11px",
        fontWeight: "600",
      },
      boardStyle: {
        borderRadius: "0.5rem",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      },
      squareStyles,
      squareRenderer,
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
      prefersReducedMotion,
      showNotation,
      activeTheme,
      squareStyles,
      squareRenderer,
      handleSquareClick,
      handlePieceDrop,
      turn,
    ],
  );

  const boardDescription = useMemo(() => {
    const sideToMove = turn === "w" ? "White" : "Black";
    const playerColor = orientation === "white" ? "White" : "Black";
    const inCheck = game.inCheck() ? ", in check" : "";
    return `Chess board position. ${sideToMove} to move${inCheck}. You play ${playerColor}.`;
  }, [game, turn, orientation]);

  return (
    <div
      role="region"
      aria-label={boardDescription}
      className={cn(
        "flex items-stretch gap-2",
        className,
        !className && BOARD_SIZE_CLASS,
      )}
    >
      <span className="sr-only">{boardDescription}</span>
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

/** A slim Stockfish eval bar. Off by default. */
function EvalBar({ cp }: { cp: number }) {
  const whiteShare = 0.5 + 0.5 * Math.tanh(cp / 400);
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
