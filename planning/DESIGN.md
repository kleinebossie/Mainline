# DESIGN.md: The Annotated Scoresheet

Visual and interaction system for the Mainline UI. This document is the source of truth for
tokens, type, layout, and the one signature device. Every color and type decision in the
codebase derives from it.

## The brief, restated

Mainline's daily deliverable is a short, evidence-graded training session. The audience is
improving adult club players who read PGN, know what an eval bar is, and distrust gamified
apps. The interface has one job: say exactly what to train, prove why, and get out of the way.

The brand promise is radical honesty (VISION §2). The design's job is therefore not to look
friendly but to look **legible and accountable** — like a document a player would trust enough
to pin above their board.

## Reference artifacts (where the visual language comes from)

1. **The scoresheet / PGN game score.** Two columns of numbered moves, monospaced, with
   annotation glyphs (`!!` `!` `?!` `??`) stuck to the end of a move. A training session _is_ a
   sequence, so Mainline typesets it as one: block 3 is move 3.
2. **The engine evaluation bar.** A thin vertical meter whose fill is the whole argument. It is
   the only progress device in the product.
3. **Printed analysis diagram.** Hairline border, coordinate strip, position, no ornament.
4. **Ballpoint annotation.** A reader's pen marks the lines that matter. Blue is reserved for
   _you are here / you can act here_ and nothing else.

## Token system

### Color (light: "Day sheet")

| Token      | Hex (approx) | HSL triplet   | Role                                                     |
| :--------- | :----------- | :------------ | :------------------------------------------------------- |
| `paper`    | `#F1F2F0`    | `90 6% 95%`   | Page ground. Printer paper, deliberately not cream.      |
| `sheet`    | `#F9FAF8`    | `100 12% 97%` | Raised surfaces, inputs, diagram plates.                 |
| `ink`      | `#1C211F`    | `162 8% 12%`  | Notation ink: headings, body, borders at full strength.  |
| `graphite` | `#5F6A66`    | `163 6% 40%`  | Secondary text, metadata, pencil-grey rules.             |
| `rule`     | `#D6D9D3`    | `96 7% 84%`   | Hairlines only. Never used as decoration.                |
| `biro`     | `#1D40C0`    | `227 74% 43%` | Interaction: links, focus, current move, selected state. |
| `tile`     | `#0D5443`    | `167 73% 19%` | Grade A, completed, confirmed.                           |
| `sage`     | `#3C7A63`    | `160 34% 36%` | Grade B.                                                 |
| `ochre`    | `#9A6408`    | `38 90% 32%`  | Grade C, caution.                                        |
| `brick`    | `#AE3120`    | `7 69% 40%`   | Grade D, blunder, destructive, error.                    |

Dark ("Night board") inverts the ground (`175 7% 10%` / `175 6% 14%`), lifts `biro` to
`215 92% 68%` and the evidence ramp to `158 55% 55%` / `40 88% 60%` / `9 75% 62%`.

**The colour law.** `tile`/`sage`/`ochre`/`brick` appear only on evidence marks, evaluation
meters, and success/error feedback. `biro` appears only where a person can act or where they
are standing. Nothing else is ever tinted. No gradients.

### Type

| Role    | Family              | Settings                                                      |
| :------ | :------------------ | :------------------------------------------------------------ |
| Display | Archivo variable    | `font-stretch: 112%`, weight 640–720, tracking `-0.024em`     |
| UI      | Archivo variable    | normal width, 440–560, sentence case                          |
| Prose   | Newsreader variable | 16.5–17.5px, line-height 1.68, italic for caveats             |
| Data    | IBM Plex Mono       | tabular-nums, 12–13px: move numbers, minutes, ratings, grades |

Scale (fluid, ratio ≈ 1.25): `48 / 36 / 27 / 21 / 17.5 / 15 / 13 / 12`. Headings are display
type; rationale paragraphs are the only serif body; nothing smaller than 12px is used for text
a person has to read twice.

Fonts are self-hosted through `@fontsource` — no third-party font request at runtime, which is
consistent with the "no ads, no tracking scripts" boundary (VISION §7).

Banned treatments: ALL-CAPS tracked labels, arrow suffixes on actions, `word — fragment`
labels, middle-dot meta strings.

### Layout

```
SIGNED-IN (desktop)                         TODAY
┌──────────┬───────────────────────────┐    ┌─────────────────────────────────┐
│ Mainline │  Mon 15 · 20 min planned  │    │ 1. Blunder drill from your  ‼   │
│ ·!       │  Tue session, not a streak│    │    games                        │
│          ├───────────────────────────┤    │    15 min · ready · from 3 games│
│ Today    │                           │    ├─────────────────────────────────┤
│ Analysis │   content measure 720px   │    │ 2. Spaced review: kings &  ?!   │
│ Library  │   (grids may run 1080px)  │    │    pawns                        │
│ Progress │                           │    │    8 min · due in 1 day         │
│          │                           │    └─────────────────────────────────┘
│ [eval]   │  ◄ session bar on rail edge│      ▲ each block carries its own eval meter
└──────────┴───────────────────────────┘
```

- Rail (240px) + one content measure, left-aligned; nothing centred except confirmations.
- Mobile: the rail becomes a 52px top strip carrying the wordmark, the nav in one row, and the
  session bar rotated to horizontal so the meter never disappears.
- Two radii only: `2px` on controls and marks, `6px` on sheets. Borders are hairline `rule`;
  elevation is a single 1px offset, not a blur stack.

### Signature

**The session bar.** One vertical eval meter, always on the rail's right edge, filled bottom-up
with the share of today's planned minutes already trained; skipped minutes hatched in `brick`.
The same device shrinks to sit on the leading edge of every block (its fill encodes evidence
strength: A full, B 72%, C 46%, D 22%) and grows to fill the landing page's hero panel. One
device, three scales, always meaning the same thing.

### Principles

1. Structure is data. A rule, a meter, a glyph, or a move number must encode something; if it
   does not, delete it.
2. Numbers align. Ratings, minutes, and counts are tabular mono, right-aligned, and never
   decorated with a label above them.
3. Boldness is spent once per screen. One element carries the personality; everything else is
   quiet, aligned, and dense.
4. Motion answers an action. One orchestrated load moment on the landing page; expansion,
   filling, and confirming transitions elsewhere. `prefers-reduced-motion` kills all of it.
5. Failure is instruction. Errors say what broke and what to press; empty states say what to do
   next. Never a mood, never an apology.
