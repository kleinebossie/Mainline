# DESIGN.md: Mainline Design System Specification

This document is the source of truth for the Mainline design system. It defines Direction A ("Sheet, refined").

---

## 1. Direction and Identity

### Direction A: "Sheet, refined"

Mainline uses Direction A ("Sheet, refined").
The system refines the original analysis sheet aesthetic into a calm, disciplined instrument.
It removes decorative graph-paper grids and heavy borders.
It uses flat surfaces with intentional whitespace, clear hierarchy, and strong typography.

### Wordmark: Option 1 (The Monogram Line)

The wordmark uses Option 1:
- An SVG icon with a geometric "M" monogram and an evergreen terminus dot.
- The title "Mainline" set in Fraunces bold.
- The accessible name for screen readers is "Mainline".

---

## 2. Color Palette and Contrast Verification

All colors are defined as CSS variables with HSL triplets in `src/app/globals.css`.

### Light Mode

| Token | Hex | HSL | Role |
| --- | --- | --- | --- |
| `--paper` | `#EEF0EA` | `80 14% 93%` | Primary background canvas |
| `--paper-raised` | `#F8F9F5` | `75 29% 97%` | Raised cards and dialog surfaces |
| `--ink` | `#15181B` | `210 13% 9%` | Primary text and dark accents |
| `--graphite` | `#5A6168` | `210 7% 38%` | Secondary and muted text |
| `--line` | `#D6DBD2` | `84 12% 84%` | Hairline borders and dividers |
| `--evergreen` | `#2E6B50` | `153 40% 30%` | Primary action and Grade A indicator |
| `--evergreen-bright` | `#20503B` | `154 43% 22%` | Accessible text green and hover states |
| `--amber` | `#8C5C15` | `36 74% 32%` | Grade C indicator and warning text |
| `--clay` | `#A8452F` | `11 56% 42%` | Destructive action and Grade D indicator |

### Dark Mode

| Token | Hex | HSL | Role |
| --- | --- | --- | --- |
| `--paper` | `#121516` | `195 10% 8%` | Dark canvas background |
| `--paper-raised` | `#1A1E20` | `200 10% 11%` | Dark raised cards and dialogs |
| `--ink` | `#ECEEE9` | `84 13% 92%` | Primary light text |
| `--graphite` | `#9BA2A8` | `208 8% 63%` | Muted and secondary text |
| `--line` | `#2C3236` | `204 10% 19%` | Dark hairline borders |
| `--evergreen` | `#4A9B76` | `153 35% 45%` | Primary action and Grade A indicator |
| `--evergreen-bright` | `#5DC092` | `152 44% 56%` | Accessible light green text |
| `--amber` | `#E5AD5A` | `36 73% 63%` | Grade C indicator and warning text |
| `--clay` | `#E06D53` | `11 69% 60%` | Destructive action and Grade D indicator |

### WCAG 2.2 AA Contrast Verification

All text color combinations exceed the WCAG 2.2 AA minimum contrast ratio (4.5:1 for normal text, 3.0:1 for large text and UI components).

#### Light Mode Pairs (on Paper `#EEF0EA`)

- Ink `#15181B`: 15.6:1 (Passes AAA)
- Graphite `#5A6168`: 5.1:1 (Passes AA normal text)
- Evergreen text `#20503B`: 7.4:1 (Passes AA normal text)
- Amber text `#8C5C15`: 4.8:1 (Passes AA normal text)
- Clay text `#A8452F`: 5.3:1 (Passes AA normal text)

#### Dark Mode Pairs (on Dark Paper `#121516`)

- Ink `#ECEEE9`: 14.8:1 (Passes AAA)
- Graphite `#9BA2A8`: 7.0:1 (Passes AA normal text)
- Evergreen text `#5DC092`: 8.5:1 (Passes AA normal text)
- Amber text `#E5AD5A`: 8.3:1 (Passes AA normal text)
- Clay text `#E06D53`: 5.2:1 (Passes AA normal text)

---

## 3. Chessboard Tokens

The chessboard uses curated tones that coordinate with the paper sheet palette:

### Light Mode Board

- `--board-light`: `#E7ECE4`
- `--board-dark`: `#7B9B8A`
- `--board-highlight`: `rgba(46, 107, 80, 0.26)`
- `--board-correct`: `rgba(46, 107, 80, 0.35)`
- `--board-mistake`: `rgba(168, 69, 47, 0.35)`

### Dark Mode Board

- `--board-light`: `#4A565C`
- `--board-dark`: `#273731`
- `--board-highlight`: `rgba(74, 155, 118, 0.35)`
- `--board-correct`: `rgba(74, 155, 118, 0.40)`
- `--board-mistake`: `rgba(224, 109, 83, 0.40)`

---

## 4. Typography

Mainline uses three type families loaded via `next/font/google`:

1. **Display & Page Titles**: `Fraunces` (`--font-fraunces`)
   - Warm, human serif voice.
   - Used for main headings and titles.
2. **Body & Controls**: `Public Sans` (`--font-public-sans`)
   - Neutral, clear, geometric sans-serif.
   - Default typeface set on `body`.
   - Used for body prose, buttons, navigation, and input controls.
3. **Tabular Figures & Notation**: `IBM Plex Mono` (`--font-plex-mono`)
   - Machine readout voice.
   - Used for chess notation, timers, ratings, and tabular numbers.

### Type Scale (6 Steps)

| Step | Size | Line Height | Weight | Typical Use |
| --- | --- | --- | --- | --- |
| Display | 36px / 2.25rem | 1.15 | 600/700 Serif | Major page titles (desktop) |
| Heading 1 | 28px / 1.75rem | 1.2 | 600 Serif | Section titles, modal titles |
| Heading 2 | 20px / 1.25rem | 1.3 | 600 Sans | Card headings, block names |
| Body | 15px / 0.9375rem | 1.5 | 400 Sans | Primary reading prose |
| Small / Control | 13px / 0.8125rem | 1.4 | 500 Sans | Buttons, inputs, secondary labels |
| Micro / Caption | 11px / 0.6875rem | 1.3 | 500 Mono | Timers, notation glyphs, badges |

---

## 5. Spacing, Radii, and Content Measures

### Content Widths

- Reading width: `680px` (`max-w-reading`). Used for single-column training, articles, and settings.
- Wide width: `1120px` (`max-w-wide`). Used for analysis boards, book shelves, and wide data tables.

### Border Radii

- Small (`sm`): `6px` (`--radius-sm`). Buttons, badges, and input fields.
- Medium (`md`): `10px` (`--radius-md`). Cards, surfaces, and popovers.
- Large (`lg`): `14px` (`--radius-lg`). Sheets, dialogs, and outer frames.

### Layout Dimensions

- Top bar height: `54px` (`h-[54px]`).
- Bottom mobile navigation bar height: `60px` (`h-[60px]`).
- Touch target minimum: `44px` on mobile viewports.

---

## 6. Signature Elements

### The Evidence Gutter

A thin vertical indicator bar on the leading edge of a block or card.
The bar color reflects the scientific evidence grade for that activity:
- Grade A: Evergreen
- Grade B: Evergreen bright
- Grade C: Amber
- Grade D: Clay
- Provisional or stub data uses a dashed pattern.

### Plain-Word Evidence Chip

The evidence chip presents the grade in plain language first.
A small chess annotation glyph follows as an accent:
- Grade A: "Strong evidence" with `!!`
- Grade B: "Some evidence" with `!`
- Grade C: "Best guess" with `?!`
- Grade D: "Not supported" with `??`

The glyph has `aria-hidden="true"`.
The accessible name communicates the full grade status to assistive technology.

### The "Why this?" Sheet

Every recommended block provides a single "Why this?" button.
Activating the button opens a sheet panel:
- Bottom sheet on viewports narrower than 768px.
- Side sheet on viewports 768px and wider.
The sheet displays the rationale text, evidence chip, evidence tier, confidence level, and source citations.
