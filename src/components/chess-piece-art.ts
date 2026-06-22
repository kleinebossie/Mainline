// Vector chess piece art — a clean, flat "drafting instrument" Staunton set authored to
// match Mainline's analysis-sheet identity (ink on cool paper). Pieces are drawn on a
// 45×45 grid (the de-facto chess-piece viewBox) as filled silhouettes with a contrasting
// keyline, so both colours stay legible on light *and* dark squares — unlike the previous
// Unicode glyphs, whose outline "white" symbols vanished on light squares.
//
// Each piece body is raw SVG markup. Fills/strokes reference the CSS custom properties
// `--pf` (piece fill) and `--ps` (piece stroke) set by the consumer, so the same markup
// renders both colours and can be re-used verbatim by tooling without drift.

export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

export const PIECE_ART_VIEWBOX = "0 0 45 45";

// Shared pedestal foot used by every tall piece (pawn keeps its own slimmer version).
const BASE =
  '<path fill="var(--pf)" stroke="var(--ps)" d="M9.5 43C9.5 40.9 11 39.6 13 39.3L14.6 36.4H30.4L32 39.3C34 39.6 35.5 40.9 35.5 43Z"/>';

export const PIECE_PATHS: Record<PieceType, string> = {
  // Pawn — head, flared body, slim foot.
  p:
    '<circle fill="var(--pf)" stroke="var(--ps)" cx="22.5" cy="12.6" r="4.4"/>' +
    '<path fill="var(--pf)" stroke="var(--ps)" d="M18.3 17.3C17.1 18.4 16.7 20.3 17.5 21.9L14.7 36.4H30.3L27.5 21.9C28.3 20.3 27.9 18.4 26.7 17.3Z"/>' +
    '<path fill="var(--pf)" stroke="var(--ps)" d="M11 43C11 41.2 12.4 40 14.2 39.8L15.6 36.4H29.4L30.8 39.8C32.6 40 34 41.2 34 43Z"/>',

  // Knight — horse head facing left. Outline derived from the canonical open-licensed
  // "cburnett" knight (the de-facto standard, instantly recognisable), translated to sit on
  // this set's baseline. Two filled body paths form the silhouette; eye + nostril are stroke-
  // coloured marks.
  n:
    '<g transform="translate(-4,4)">' +
    '<path fill="var(--pf)" stroke="var(--ps)" d="M22 10C32.5 11 38.5 18 38 39L15 39C15 30 25 32.5 23 18"/>' +
    '<path fill="var(--pf)" stroke="var(--ps)" d="M24 18C24.38 20.91 18.45 25.37 16 27C13 29 13.18 31.34 11 31C9.96 30.06 12.41 27.96 11 28C10 28 11.19 29.23 10 30C9 30 6 31 6 26C6 24 12 14 12 14C12 14 13.89 12.1 14 10.5C13.27 9.51 13.5 8.5 13.5 7.5C14.5 6.5 16.5 10 16.5 10L18.5 10C18.5 10 19.28 8.01 21 7C22 7 22 10 22 10"/>' +
    '<circle fill="var(--ps)" stroke="none" cx="9" cy="25.5" r="0.8"/>' +
    '<ellipse fill="var(--ps)" stroke="none" cx="14.7" cy="15.8" rx="0.6" ry="1.6" transform="rotate(30 14.7 15.8)"/>' +
    "</g>",

  // Bishop — mitre with top ball and the iconic diagonal slit, on a collar.
  b:
    BASE +
    '<path fill="var(--pf)" stroke="var(--ps)" d="M17 26.2H28L29.9 30.2H15.1Z"/>' +
    '<path fill="var(--pf)" stroke="var(--ps)" d="M22.5 11.4C26.3 12.3 28.1 16.6 27.3 21C26.6 24.1 24.6 26.4 22.5 26.4C20.4 26.4 18.4 24.1 17.7 21C16.9 16.6 18.7 12.3 22.5 11.4Z"/>' +
    '<circle fill="var(--pf)" stroke="var(--ps)" cx="22.5" cy="8.9" r="2.1"/>' +
    '<path fill="none" stroke="var(--ps)" stroke-width="1" d="M20.8 15.4L24.2 18.9"/>',

  // Rook — crenellated crown, waisted body, foot.
  r:
    BASE +
    '<path fill="var(--pf)" stroke="var(--ps)" d="M14.6 17.4H30.4L28.4 20.1L27.5 32.2L30.4 35.6H14.6L17.5 32.2L16.6 20.1Z"/>' +
    '<path fill="var(--pf)" stroke="var(--ps)" d="M12.5 12H16.5V14.6H19.6V12H25.4V14.6H28.5V12H32.5V17.6H12.5Z"/>',

  // Queen — five-point spiked crown with balls, flared body.
  q:
    BASE +
    '<path fill="var(--pf)" stroke="var(--ps)" d="M11.6 25.6H33.4L31 36.4H14Z"/>' +
    '<path fill="var(--pf)" stroke="var(--ps)" d="M11 25.6L9 12.6L13.5 19.6L15.9 11L19.2 18.9L22.5 10.5L25.8 18.9L29.1 11L31.5 19.6L36 12.6L34 25.6Z"/>' +
    '<circle fill="var(--pf)" stroke="var(--ps)" cx="9" cy="12.6" r="2.2"/>' +
    '<circle fill="var(--pf)" stroke="var(--ps)" cx="15.9" cy="11" r="2.2"/>' +
    '<circle fill="var(--pf)" stroke="var(--ps)" cx="22.5" cy="10.4" r="2.3"/>' +
    '<circle fill="var(--pf)" stroke="var(--ps)" cx="29.1" cy="11" r="2.2"/>' +
    '<circle fill="var(--pf)" stroke="var(--ps)" cx="36" cy="12.6" r="2.2"/>',

  // King — cross finial, bell crown, collar.
  k:
    BASE +
    '<path fill="var(--pf)" stroke="var(--ps)" d="M16.6 28.4H28.4L30.6 36.4H14.4Z"/>' +
    '<path fill="var(--pf)" stroke="var(--ps)" d="M22.5 15.4C26.6 15.4 29.6 18.8 28.9 23.3C28.4 26.4 25.5 28.7 22.5 28.7C19.5 28.7 16.6 26.4 16.1 23.3C15.4 18.8 18.4 15.4 22.5 15.4Z"/>' +
    '<path fill="var(--pf)" stroke="var(--ps)" stroke-linejoin="round" d="M21 6.4H24V8.9H26.6V12H24V15.6H21V12H18.4V8.9H21Z"/>',
};
