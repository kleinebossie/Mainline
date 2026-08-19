// Pure tactical motif detection from chess positions and moves (BUILD.md §5.2).
// PURE & DETERMINISTIC (L2). Uses chess.js to analyze board geometry and piece interactions.

import { Chess, type PieceSymbol, type Square } from "chess.js";

export interface TacticalMotif {
  key: string;
  title: string;
  description: string;
  evidenceGrade: "A" | "B" | "C" | "D";
  evidenceTier: number;
  citationKey: string;
}

export const TACTICAL_MOTIFS: Record<string, TacticalMotif> = {
  hangingPiece: {
    key: "hangingPiece",
    title: "Hanging Pieces",
    description:
      "Unprotected pieces that opponents can capture without loss of material.",
    evidenceGrade: "A",
    evidenceTier: 1,
    citationKey: "weakness_diagnosis",
  },
  fork: {
    key: "fork",
    title: "Forks",
    description:
      "A single piece that attacks two or more enemy targets at the same time.",
    evidenceGrade: "A",
    evidenceTier: 1,
    citationKey: "chase_simon1973",
  },
  pin: {
    key: "pin",
    title: "Pins",
    description:
      "A piece that cannot move because it protects a more valuable piece behind it.",
    evidenceGrade: "A",
    evidenceTier: 1,
    citationKey: "chase_simon1973",
  },
  backRankMate: {
    key: "backRankMate",
    title: "Back-Rank Weakness",
    description:
      "A trapped king on the home row vulnerable to rook or queen attacks.",
    evidenceGrade: "A",
    evidenceTier: 1,
    citationKey: "chase_simon1973",
  },
  skewer: {
    key: "skewer",
    title: "Skewers",
    description:
      "An attack on a high-value piece that forces it to move and exposes a target behind it.",
    evidenceGrade: "A",
    evidenceTier: 1,
    citationKey: "chase_simon1973",
  },
  discoveredAttack: {
    key: "discoveredAttack",
    title: "Discovered Attacks",
    description:
      "Moving one piece uncovers a direct attack from a second piece behind it.",
    evidenceGrade: "A",
    evidenceTier: 1,
    citationKey: "chase_simon1973",
  },
  trappedPiece: {
    key: "trappedPiece",
    title: "Trapped Pieces",
    description:
      "A valuable piece with no safe escape squares attacked by enemy pieces.",
    evidenceGrade: "A",
    evidenceTier: 1,
    citationKey: "chase_simon1973",
  },
  attackingF2F7: {
    key: "attackingF2F7",
    title: "Weak f2/f7 Square",
    description:
      "Attacks targeting the weak f2 or f7 pawn before the king castles.",
    evidenceGrade: "A",
    evidenceTier: 1,
    citationKey: "chase_simon1973",
  },
  advantage: {
    key: "advantage",
    title: "Tactical Conversion",
    description:
      "Sharp middlegame positions where tactical chances and defense decide the game.",
    evidenceGrade: "A",
    evidenceTier: 1,
    citationKey: "weakness_diagnosis",
  },
};

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 100,
};

const DIAGONAL_DELTAS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

const ORTHOGONAL_DELTAS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function squareToCoords(sq: Square): [number, number] {
  const file = sq.charCodeAt(0) - 97; // 'a' -> 0
  const rank = 8 - parseInt(sq[1]!, 10); // '8' -> 0, '1' -> 7
  return [rank, file];
}

function coordsToSquare(rank: number, file: number): Square | null {
  if (rank < 0 || rank > 7 || file < 0 || file > 7) return null;
  const f = String.fromCharCode(97 + file);
  const r = String(8 - rank);
  return `${f}${r}` as Square;
}

/**
 * Detect the primary tactical motif of a position given the solution or mistake move.
 */
export function detectTacticalMotif(
  fen: string,
  bestMoveUci?: string | null,
  playedMoveSan?: string | null,
): TacticalMotif {
  if (!fen) return TACTICAL_MOTIFS.advantage!;

  try {
    const chess = new Chess(fen);
    const sideToMove = chess.turn(); // 'w' | 'b'
    const oppSide = sideToMove === "w" ? "b" : "w";

    if (bestMoveUci && bestMoveUci.length >= 4) {
      const from = bestMoveUci.slice(0, 2) as Square;
      const to = bestMoveUci.slice(2, 4) as Square;
      const piece = chess.get(from);

      // 1. Back-Rank Mate or Infiltration
      const targetRank = oppSide === "b" ? "8" : "1";
      if (
        (piece?.type === "r" || piece?.type === "q") &&
        to.endsWith(targetRank)
      ) {
        const board = chess.board();
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const sq = board[r]?.[c];
            if (sq && sq.type === "k" && sq.color === oppSide) {
              if (sq.square.endsWith(targetRank)) {
                const clone = new Chess(fen);
                const applied = clone.move({
                  from,
                  to,
                  promotion: (bestMoveUci[4] as PieceSymbol) || "q",
                });
                if (applied && (clone.inCheck() || clone.isCheckmate())) {
                  return TACTICAL_MOTIFS.backRankMate!;
                }
              }
            }
          }
        }
      }

      // 2. Attacking weak f2 / f7
      if (
        (oppSide === "b" && to === "f7") ||
        (oppSide === "w" && to === "f2")
      ) {
        const clone = new Chess(fen);
        const applied = clone.move({
          from,
          to,
          promotion: (bestMoveUci[4] as PieceSymbol) || "q",
        });
        if (
          applied &&
          (clone.inCheck() ||
            clone.isCheckmate() ||
            piece?.type === "b" ||
            piece?.type === "n" ||
            piece?.type === "q")
        ) {
          return TACTICAL_MOTIFS.attackingF2F7!;
        }
      }

      // 3. Ray-tracing for Pins and Skewers
      if (piece && (piece.type === "b" || piece.type === "r" || piece.type === "q")) {
        const deltas =
          piece.type === "b"
            ? DIAGONAL_DELTAS
            : piece.type === "r"
              ? ORTHOGONAL_DELTAS
              : [...DIAGONAL_DELTAS, ...ORTHOGONAL_DELTAS];

        const [r0, c0] = squareToCoords(to);
        const clone = new Chess(fen);
        const applied = clone.move({
          from,
          to,
          promotion: (bestMoveUci[4] as PieceSymbol) || "q",
        });

        if (applied) {
          for (const [dr, dc] of deltas) {
            let r = r0 + dr!;
            let c = c0 + dc!;
            let p1: { square: Square; type: PieceSymbol; color: string } | null = null;
            let p2: { square: Square; type: PieceSymbol; color: string } | null = null;

            while (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
              const sq = coordsToSquare(r, c);
              if (sq) {
                const occ = clone.get(sq);
                if (occ) {
                  if (occ.color === sideToMove) {
                    break;
                  }
                  if (!p1) {
                    p1 = { square: sq, type: occ.type, color: occ.color };
                  } else {
                    p2 = { square: sq, type: occ.type, color: occ.color };
                    break;
                  }
                }
              }
              r += dr!;
              c += dc!;
            }

            if (p1 && p2 && p1.color === oppSide && p2.color === oppSide) {
              const val1 = PIECE_VALUES[p1.type];
              const val2 = PIECE_VALUES[p2.type];
              if (p2.type === "k" || p2.type === "q" || val2 > val1) {
                return TACTICAL_MOTIFS.pin!;
              }
              if (val1 > val2 && (p1.type === "k" || p1.type === "q")) {
                return TACTICAL_MOTIFS.skewer!;
              }
            }
          }
        }
      }

      // 4. Tactical Forks (Double Attacks)
      if (piece) {
        const clone = new Chess(fen);
        const applied = clone.move({
          from,
          to,
          promotion: (bestMoveUci[4] as PieceSymbol) || "q",
        });
        if (applied) {
          const attackedPieces: Array<{ square: Square; type: PieceSymbol }> = [];
          const allOppSquares = clone
            .board()
            .flat()
            .filter((p) => p && p.color === oppSide);

          for (const oppPiece of allOppSquares) {
            if (!oppPiece) continue;
            const isAttacked = clone.isAttacked(oppPiece.square, sideToMove);
            if (isAttacked) {
              const tempChess = new Chess(clone.fen());
              tempChess.remove(to);
              const stillAttacked = tempChess.isAttacked(
                oppPiece.square,
                sideToMove,
              );
              if (!stillAttacked) {
                attackedPieces.push({
                  square: oppPiece.square,
                  type: oppPiece.type,
                });
              }
            }
          }

          const hasKing = attackedPieces.some((p) => p.type === "k");
          const highValPieces = attackedPieces.filter(
            (p) => PIECE_VALUES[p.type] >= 3,
          );

          if (
            (hasKing && attackedPieces.length >= 2) ||
            highValPieces.length >= 2 ||
            attackedPieces.length >= 2
          ) {
            return TACTICAL_MOTIFS.fork!;
          }
        }
      }

      // 5. Hanging Piece (Capturing an undefended piece or higher-value piece)
      const targetPiece = chess.get(to);
      if (targetPiece && targetPiece.color === oppSide) {
        const attackerVal = piece ? PIECE_VALUES[piece.type] : 0;
        const targetVal = PIECE_VALUES[targetPiece.type];
        const isDefended = chess.isAttacked(to, oppSide);

        if (!isDefended || targetVal > attackerVal) {
          return TACTICAL_MOTIFS.hangingPiece!;
        }
      }
    }

    // 6. Check if played move in the original position hung a piece
    if (playedMoveSan) {
      try {
        const clone = new Chess(fen);
        const applied = clone.move(playedMoveSan);
        if (applied) {
          const dest = applied.to;
          const movedPiece = clone.get(dest);
          if (movedPiece) {
            const isAttacked = clone.isAttacked(dest, oppSide);
            const isDefended = clone.isAttacked(dest, sideToMove);
            if (isAttacked && !isDefended) {
              return TACTICAL_MOTIFS.hangingPiece!;
            }
          }
        }
      } catch {
        // Ignore parsing errors for playedMoveSan
      }
    }

    return TACTICAL_MOTIFS.advantage!;
  } catch {
    return TACTICAL_MOTIFS.advantage!;
  }
}
