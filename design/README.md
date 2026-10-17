# UI overhaul prototypes

This directory contains static design prototypes for Phase 0 of the Mainline UI overhaul. See [UI_OVERHAUL.md](../planning/UI_OVERHAUL.md) for the complete plan.

These files are versioned design artifacts. They do not ship in the Next.js production build.

## How to view the prototypes

You can view the prototypes in any web browser.

1. Open `design/prototypes/index.html` directly in your browser.
2. Alternatively, serve this directory with any local static file server:
   ```bash
   npx serve design/prototypes
   ```
   or
   ```bash
   python3 -m http.server --directory design/prototypes 8080
   ```
3. Open the local address in your browser.

Use `index.html` to compare all three directions side by side or across phone and desktop viewports.

## Prototype directions

The prototypes explore three visual directions. Each direction contains three screens: `today.html`, `puzzle.html`, and `wordmark.html`.

### Direction A: Sheet, refined (`direction-a/`)

- Concept: Cleans up the current identity.
- Palette: Paper (`#EEF0EA`), Raised (`#F8F9F5`), Ink (`#15181B`), Graphite (`#5A6168`), Evergreen (`#2E6B50`), Clay (`#A8452F`).
- Typography: Fraunces (page titles), Public Sans (body and controls), IBM Plex Mono (numbers).
- Signature: Thin evidence gutter on the leading edge of each block.
- Files:
  - `direction-a/today.html`: Daily training session in progress (2 of 4 blocks complete).
  - `direction-a/puzzle.html`: Puzzle focus mode with correct and mistake feedback states.
  - `direction-a/wordmark.html`: Wordmark options.

### Direction B: Diagram (`direction-b/`)

- Concept: Printed chess books and Lichess. Black print on paper with one spot color.
- Palette: Paper (`#FBFBF9`), Print (`#111111`), Rule (`#D9D9D4`), Spot blue (`#2340B8`), Mistake red (`#B8382B`), Quiet grey (`#6B6B66`).
- Typography: Alegreya (titles), Alegreya Sans (body and tabular numbers), Noto Sans Symbols 2 (chess figurines).
- Signature: Main-line hierarchy. Bold text shows the primary path. Regular text shows variations and options.
- Files:
  - `direction-b/today.html`: Daily training session in progress (2 of 4 blocks complete).
  - `direction-b/puzzle.html`: Puzzle focus mode with correct and mistake feedback states.
  - `direction-b/wordmark.html`: Wordmark options.

### Direction C: Clock (`direction-c/`)

- Concept: Tactile warmth inspired by analogue chess clocks and calm productivity tools.
- Palette: Enamel (`#F3F3EF`), Case (`#2A2623`), Brass (`#A9823A`), Felt (`#2F5D50`), Flag (`#C2412D`), Dial (`#8C8A85`).
- Typography: Barlow Condensed (titles and large figures), Atkinson Hyperlegible Next (body and controls).
- Signature: Time-budget dial on Today showing planned minutes per block.
- Files:
  - `direction-c/today.html`: Daily training session in progress (2 of 4 blocks complete).
  - `direction-c/puzzle.html`: Puzzle focus mode with correct and mistake feedback states.
  - `direction-c/wordmark.html`: Wordmark options.

## Next steps

The product owner reviews the three directions on phone and desktop screens. After the owner selects a direction, record the chosen tokens and rules in `design/DESIGN.md`. Phase 1 implementation begins only after approval of `design/DESIGN.md`.
