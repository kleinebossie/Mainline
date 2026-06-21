# What Actually Raises Chess Rating, Per Level: An Evidence-Graded Analysis

## TL;DR

- **The two activities with the strongest (still only observational) chess-specific support for raising game rating are playing rated games and reducing blunders/error rate.** In the only large longitudinal dataset (Howard 2012, n=533 FIDE players), the log number of games played was the strongest predictor of latest rating, while independent study hours had "negligible" effect. Everything else rides on either correlation (puzzle rating ↔ game rating, r≈0.81) or general learning-science meta-analyses extrapolated to chess.
- **Tactics/puzzle training is the highest-ROI study activity by expert consensus, but the causal evidence is weak:** there is NO randomized or quasi-experimental study showing a puzzle regimen raises game rating, and one large analysis found ZERO correlation (r=−0.02) between puzzle _volume_ and closing the puzzle-game gap. Puzzles help when deliberate, themed, reflective and spaced — not when grinded mindlessly.
- **The optimal mix shifts by level:** below ~1200 online, games are decided by one-move blunders, so blunder-checking + basic tactics + simply playing dominate; openings/endgame theory and master-game study earn their place only at ~1600+. Coaching has modest longitudinal support; spaced repetition of failed tactics is strongly supported by general memory science but unproven in chess specifically.

## Key Findings (Executive Summary — 14 highest-confidence takeaways)

1. **Playing rated games is the single most robust correlate of rating gain** (Howard 2012, observational; Grade B). Diminishing returns set in within a few years (Vaci & Bilalić 2014, n=1,383: year-1 gain ≈ 2× year-2).
2. **At <1200 online, most games are decided by blunders** (hanging pieces, one-move tactics). Error reduction is the highest-leverage lever at low levels; blunder rate falls smoothly and monotonically with rating (Anson & Kleinberg arXiv 2016). Grade B for the descriptive claim; Grade C that explicit blunder-check training fixes it.
3. **Tactics/puzzle training is the best-supported _study_ activity by expert consensus and a strong correlational backbone** (puzzle rating ↔ rapid rating R=0.815 in a 2,763-player Lichess analysis), but there is **no experimental proof it causes rating gains**. Grade B (correlational) / Grade C (causal).
4. **Grinding puzzle _volume_ is largely a myth:** the same 2,763-player analysis found essentially zero correlation (r=−0.02) between number of puzzles solved and closure of the puzzle-game gap. Grade B against volume-for-its-own-sake.
5. **Retrieval practice (the "testing effect") is one of the most replicated findings in learning science.** Adesope, Trevisan & Sundararajan (2017, _Review of Educational Research_ 87(3):659–701), pooling 272 independent effects from 188 experiments, found practice testing produced "a moderate, statistically significant weighted mean effect size compared to re-studying (+0.51)" and g=0.61 versus all other practices combined. Re-solving failed puzzles from memory is the chess application — Tier 2 (extrapolated), Grade A in general, Grade C in chess.
6. **Spaced/distributed practice is robustly superior to massed practice** (Cepeda et al. 2006 meta-analysis, 839 assessments across 317 experiments). This is the science behind spaced repetition of tactics (Woodpecker, FSRS). Tier 2 Grade A; chess-specific Grade C.
7. **FSRS outperforms the older SM-2 scheduler.** On the open-spaced-repetition benchmark (9,999 Anki collections, ~350M filtered reviews), FSRS-6 with per-user optimization reaches a mean log loss of 0.344 and beats SM-2 in 99.6% of collections; simulations imply "students using FSRS need 20 to 30 percent fewer reviews to maintain the same retention rate." Strong evidence the _algorithm_ works for flashcard recall; no chess-pattern-specific validation. Grade A (general) / Grade C (chess patterns).
8. **The "85% rule" gives a principled puzzle-difficulty target:** learning is fastest at ~85% success / ~15% error (Wilson et al. 2019, _Nature Communications_ 10:4646) — but it was derived for stochastic-gradient-descent binary classifiers and biologically plausible perceptual learners, NOT human chess pattern learning. Use it as a default, not a law. Grade B/C.
9. **Deliberate practice explains only about a quarter to a third of variance in chess skill.** Macnamara, Hambrick & Oswald (2014, _Psychological Science_ 25(8):1608–1618): "deliberate practice explained 26% of the variance in performance for games, 21% for music, 18% for sports, 4% for education, and less than 1% for professions" (41% of _reliable_ variance for games); Hambrick et al. (2014) put the reliable-variance figure at ~34% for chess. Practice is "necessary but not sufficient" (Gobet & Campitelli 2007); hours needed to reach master ranged from ~3,016 to ~23,608 — enormous individual variation.
10. **Cognitive ability correlates modestly with chess skill.** Burgoyne, Sala, Gobet, Macnamara, Campitelli & Hambrick (2016, _Intelligence_ 59:72–83, k=19): "the meta-analytic average of the correlations was (r = 0.24)," and "chess skill correlated more strongly with numerical ability (r = 0.35) than with verbal ability (r = 0.19) or visuospatial ability (r = 0.13)." The fluid-reasoning correlation was stronger for youth (r=0.32) than adults (r=0.11) and for unranked (r=0.32) than ranked (r=0.14) samples. This caps how much any app can promise and argues against one-size-fits-all dosing.
11. **Chess expertise is fundamentally pattern/chunk recognition** (de Groot 1946/1965; Chase & Simon 1973; Gobet & Simon template theory). This is the theoretical reason tactics/pattern drilling and master-game exposure _should_ help — Tier 2 theory, Grade C as a training prescription.
12. **Coaching has "some effect over time"** in Howard's longitudinal data (Grade B/C); it is also the mechanism for individualization, which deliberate-practice theory holds is the most important moderator.
13. **Longer time controls are near-universally recommended for _improvement_** because they allow calculation and surface real (not time-scramble) mistakes — but this is coaching folklore, not experimentally established. Grade C. Blitz/bullet are not "worthless" but have weaker learning value per game.
14. **Chess→academic-skill transfer is weak and confounded** (Sala & Gobet 2016 meta-analysis g=0.34, but no active controls; Sala, Foley & Gobet 2017). Irrelevant to rating gains, but important context: do not market cognitive/IQ benefits.

---

## Methodological Notes

**Rating band anchoring.** Bands below are anchored to **online ratings** and are deliberately fuzzy. Lichess ratings run materially higher than Chess.com at comparable strength; both differ from FIDE. As one calibration point, the chessanalysis.co regression estimated that a Lichess puzzle rating of ~2,016 (empirical median) corresponds to a Chess.com Rapid rating of ~1,500. Treat all band boundaries as ±150 points.

**Two evidence tiers, kept separate throughout:**

- **Tier 1 — Chess-specific evidence measuring rating/skill** (de Groot; Chase & Simon; Gobet & Campitelli; Howard; Burgoyne; large Lichess/Chess.com data analyses). Often observational and methodologically weak, but it is _about chess_.
- **Tier 2 — Strong general learning-science evidence** (retrieval practice, spacing, desirable difficulties, the 85% rule, habit formation, self-determination theory) that only _implies_ a chess benefit by extrapolation.

**Grades:** A = strong, replicated; B = suggestive but limited; C = theory/expert opinion only; D = popular belief unsupported or contradicted.

**The central honest caveat:** No randomized or quasi-experimental study has demonstrated that ANY specific training activity _causes_ a measured game-rating increase. The chess-specific literature is dominated by cross-sectional correlation and self-report longitudinal data, both of which suffer reverse causation (stronger players study/play more) and selection effects. We therefore lean on Tier 2 science for mechanism and Tier 1 correlation for direction, and we flag causation explicitly everywhere.

---

## Main Body: Activity-by-Activity

### 1. Solving Tactics / Puzzles (volume, difficulty targeting)

**Recommendation:** Make themed, reflective tactics the backbone of training below ~1800, but cap mindless volume. Target a success rate near the desirable-difficulty zone, mix in failed-puzzle review (see §11), and require a 15–30s "why does this work" reflection after each solve/fail.

| Parameter           | Default                                                                | Source / rationale                                     |
| ------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------ |
| Daily puzzle dose   | 10–20 themed puzzles                                                   | Beats 50 random (chessanalysis.co; coaching consensus) |
| Target success rate | ~80–85% on mixed sets                                                  | Wilson et al. 2019 "85% rule" (Tier 2, extrapolated)   |
| Difficulty          | Slightly below–at player rating; "1 move"/"mate in 1" themes for <1000 | chessanalysis.co band guide                            |
| Reflection          | 15–30s per puzzle on the pattern                                       | Retrieval/elaboration (Roediger & Karpicke)            |
| Volume cap          | Stop chasing raw counts                                                | r=−0.02 puzzle volume vs gap closure                   |

**Per-band notes:**

- **<800:** Almost pure safety/board-awareness. "Mate in 1," "hanging piece," one-move themes. Blunders dominate outcomes (~18 blunders per 10 games below 1000).
- **800–1200:** Forks, pins, discovered attacks; 10–15 themed/day. Basic motifs become the differentiator.
- **1200–1600:** Two-move combinations + endgame-themed puzzles (rook endgames appear in ~18% of games here); begin "create the tactic" / quiet-move puzzles.
- **1600–2000:** Calculation-heavy and defensive/quiet-move puzzles; tactics shift from spotting to engineering.
- **2000–2200:** Maintain sharpness; diminishing rating ROI vs openings/endgames/analysis.
- **2200+:** Maintenance + deep calculation sets; tactics rarely the binding constraint.

**Evidence grade:** **B (correlational)** that tactical strength tracks rating; **C (causal)** that puzzle training raises rating; **D** for "just grind thousands of puzzles."
**Key citations:** Chase & Simon (1973), _Cognitive Psychology_ 4:55–81; chessanalysis.co (2,763-player Lichess analysis, R=0.815); Wilson et al. (2019), _Nat Commun_ 10:4646.
**Confidence/caveats:** The "I know there's a tactic" cue is absent in real games; puzzle rating overstates in-game tactical execution by ~250+ points on the Lichess scale (mean gap 258, narrowing from ~363 below 600 to ~64 at 2000+). Causation unproven.
**User-facing line:** "Tactics are the fastest way to stop losing games to one-move mistakes — but only if you understand each pattern, not just rush through hundreds."

### 2. Analysing One's Own Games

**Recommendation:** Make light post-game review (especially of losses) a default habit from day one; deepen it at 1200+. Focus low-rated players on "what did I hang and why," and higher-rated players on quiet/positional turning points.
**Per-band:** <1200 — identify the blunder and the missed safety check; 1200–1600 — find the quiet move that let the opponent equalize; 1600+ — opening-choice and strategic-plan errors.
**Evidence grade:** **C.** This is near-universal coaching folklore with essentially no peer-reviewed test of its rating effect. The strongest pro-claim is a data-blog modeling exercise, not a controlled study: ChessGoals' "Year 1" study-plan analysis asserts that "the number one thing that predicts gains at the novice level is analyzing one's own games," with their modeled efficient novice (1.5 hrs/week on game analysis) out-gaining peers who spent more time merely playing or on opening study — but this is proprietary modeling, not experimental evidence. Mechanistically it operationalizes retrieval + error-driven learning (Tier 2) and individualization (the part of deliberate-practice theory with the largest claimed effect).
**Key citations:** No peer-reviewed chess-rating study. ChessGoals "Best Chess Study Plan – Year 1" (data-blog, low-evidence). Mechanism: Roediger & Karpicke (2006); Ericsson, Krampe & Tesch-Römer (1993), _Psych Review_ 100:363–406.
**Confidence/caveats:** High face validity, low evidentiary support. Label as expert/data-blog opinion, not established fact.
**User-facing line:** "Reviewing your own losses is how you find _your_ specific leaks — generic advice can't."

### 3. Endgame Study

**Recommendation:** Light, high-frequency endgame fundamentals (K+P, basic rook endings, Lucena/Philidor) starting ~1200; not a priority below 1000 where games rarely reach clean endgames.
**Per-band:** <1000 — minimal (games end earlier in blunders); 1200–1600 — basic conversions and rook endings have real ROI; 1600–2200 — theoretical endings and conversion technique; 2200+ — deep theoretical preparation.
**Evidence grade:** **C** (coaching consensus + chunk/pattern theory). No chess-specific rating experiment.
**Key citations:** Theory only — Gobet & Simon template theory; coaching consensus.
**User-facing line:** "Knowing a handful of key endgames turns 'draws' and 'losses' into wins once you reach 1200+."

### 4. Opening Study / Preparation

**Recommendation:** Minimal at low levels (principles, not memorization); grows in value only at ~1600+ and becomes significant at 2000+. A common GM study plan allocates ~30% to openings only for 1500–2000 players.
**Per-band:** <1200 — learn opening _principles_ and avoid traps, don't memorize lines; 1200–1600 — a small, repeatable repertoire; 1600–2000 — real repertoire work; 2000+ — deep, engine-assisted prep matters competitively.
**Evidence grade:** **C**, and **D** for heavy opening memorization at low levels (contradicted by blunder data — beginners lose to hanging pieces, not opening theory).
**Key citations:** chessanalysis.co blunder taxonomy; coaching consensus.
**User-facing line:** "Below ~1600, deep opening memorization is mostly wasted — you'll lose the game later to a blunder, not the opening."

### 5. Calculation / Visualization Drills

**Recommendation:** Introduce "solve without moving pieces" and short visualization drills at ~1400+, where calculation depth/accuracy becomes the separator.
**Per-band:** <1200 — pattern recognition matters more than deep calculation; 1400–2000 — calculation quality becomes the main differentiator (per blunder-type clustering); 2000+ — depth and accuracy are core.
**Evidence grade:** **C.** No controlled study quantifies a rating effect from calculation/visualization training (confirmed: anecdotal only, e.g., de la Maza's "Chess Vision" drills, n=1).
**Key citations:** None with rating outcomes; theory via Chase & Simon / Gobet.
**User-facing line:** "Calculating without touching the pieces builds the visualization you'll need as opponents stop blundering."

### 6. Time Control Choice (rapid/classical vs blitz/bullet)

**Recommendation:** For _improvement_, default to rapid/classical as the majority of serious play; allow blitz as a smaller share and always pair fast games with review.
**Parameters (from ChessGoals' data-blog modeling, low-evidence):** Their general study plans "recommend blitz chess at about 25-30% of the overall time spent on chess"; for players whose goal is specifically rapid/classical improvement, the optimal blitz share is "much closer to 15%," and they note "playing little to no blitz will underperform spending 15% or more of your chess time on blitz." Treat these as tunable defaults, not validated thresholds.
**Per-band:** Lower-rated players benefit most from longer controls (time to run a blunder check); strong players can use blitz to test prep/instincts. Bullet has the least learning value per game.
**Evidence grade:** **C.** Strong coaching consensus and mechanistic plausibility (longer time → calculation → real mistakes surface), but no experiment proves time control affects _improvement rate_. Game-quality analyses show blitz games are markedly lower quality than rapid even at GM level, supporting the mechanism.
**Key citations:** ChessGoals time-allocation modeling; Chessenginelab game-quality analysis (blitz << rapid accuracy). All non-experimental.
**Confidence/caveats:** "Longer is better for learning" is plausible and widely held but unproven; don't overstate.
**User-facing line:** "Play mostly slow enough to actually think — that's where you learn. Use blitz in moderation and always review."

### 7. Blunder-Checking Habits / Error Reduction

**Recommendation:** Build an explicit pre-move blunder check (the "is anything hanging / what does my opponent's move threaten?" routine) as a trained habit, especially below 1600. This is arguably the highest-leverage behavioural intervention at low levels.
**Per-band:** <1200 — the single biggest lever; ~40% of low-level blunders occur in already-winning positions. 1200–1800 — blunders shrink but the mistake rate (100–299 cp loss) stays high; 1800+ — errors shift from piece-drops to evaluation mistakes; blunder checking still useful under time pressure.
**Evidence grade:** **B** for the descriptive claim that low-level results are dominated by blunders (multiple large engine-analysis datasets: Anson & Kleinberg arXiv 2016, "the blunder rate declines smoothly with rating... with a flattening at higher ratings"; chessanalysis.co ~18 blunders/10 games below 1000). **C** that a trained blunder-check routine raises rating (plausible, untested).
**Key citations:** "Assessing Human Error Against a Benchmark of Perfection" (arXiv 1606.04956); chessanalysis.co band data; ChessBase "Grandmaster blunders" statistical analysis.
**Habit-formation science (Tier 2):** Lally et al. (2010), _EJSP_ 40:998–1009 — automaticity took a median ~66 days (range 18–254); consistency in a stable context predicts habit strength.
**User-facing line:** "One disciplined 'is anything hanging?' check before every move wins more rating at low levels than any amount of theory."

### 8. Studying Master / Annotated Games

**Recommendation:** Introduce annotated master games at ~1400+ for strategic pattern exposure; low value below 1200 (too abstract relative to the blunder problem).
**Per-band:** <1200 — low priority; 1400–2000 — valuable for middlegame plans and pattern bank; 2000+ — core to building deep templates.
**Evidence grade:** **C.** Pattern/template theory (Chase & Simon; Gobet & Simon) predicts benefit via chunk acquisition, but no rating experiment exists.
**Key citations:** Chase & Simon (1973); Gobet & Simon (1996) template theory.
**User-facing line:** "Studying master games slowly builds the positional 'vocabulary' that tactics alone can't."

### 9. Coaching / Instruction

**Recommendation:** Recommend periodic coaching especially at plateaus; its core value is individualization and error diagnosis. In-app analogue: personalized weakness detection and targeted drills.
**Per-band:** Useful at all levels; ROI rises where self-diagnosis fails (plateaus, 1600+).
**Evidence grade:** **B/C.** Howard (2012) found coaching "had some effect over time" in longitudinal FIDE data (observational). Deliberate-practice theory holds individualization is the key moderator (one reanalysis of 178 players claimed effect sizes more than 3× larger at high individualization).
**Key citations:** Howard (2012), _Applied Cognitive Psychology_ 26:359–369; Ericsson et al. (1993).
**User-facing line:** "A coach (or smart personalized feedback) finds the leaks you can't see yourself — most valuable when you're stuck."

### 10. Competition / Tournament Frequency (playing more rated games)

**Recommendation:** Encourage a steady, sustainable cadence of rated games at improvement-friendly time controls; this is the activity with the strongest chess-specific support.
**Per-band:** Valuable at all levels; diminishing per-year returns mean beginners gain fastest. Avoid pure-blitz/bullet diets, which the longitudinal data and coaching consensus consider low-value for improvement.
**Evidence grade:** **B.** Howard (2012): log(games played) was the strongest predictor of rating, with a strong effect even when participants were equated on time-in-domain; study hours had negligible independent effect. Vaci & Bilalić (2014, n=1,383): rating follows a negative-exponential curve (year-1 gain ≈ 2× year-2). Both observational — reverse causation plausible, and Howard's self-report study-time measure was contested (Burgoyne et al. 2016).
**Key citations:** Howard (2012); Howard (2013), _Br J Psychol_ 104:39–56; Vaci & Bilalić (2014), _Front Psychol_ (PMC4141457).
**User-facing line:** "Playing real, rated games — and learning from them — is the most reliable driver of rating we can point to in the data."

### 11. Spaced-Repetition Review of Failed Tactics (Leitner / SM-2 / FSRS; "redo failed puzzles")

**Recommendation:** Build a spaced-repetition queue of _failed_ puzzles. Re-present them from memory (retrieval), on expanding intervals. This combines three of the strongest Tier 2 effects (retrieval + spacing + desirable difficulty) and directly mirrors the Woodpecker Method and the Lichess "redo failed puzzles" flow.

| Parameter                            | Default                          | Source                                                                                      |
| ------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------- |
| Scheduler                            | FSRS (fallback SM-2)             | FSRS beats SM-2 in 99.6% of ~10k Anki collections; ≈20–30% fewer reviews for same retention |
| What to review                       | Failed/missed puzzles first      | Error-driven learning; chess.com forum consensus                                            |
| Review mode                          | Recall solution before revealing | Retrieval practice (Roediger & Karpicke 2006; Adesope 2017 g≈0.51–0.61)                     |
| Interval shape                       | Expanding                        | Cepeda et al. 2006 (spacing); Woodpecker halving cycles                                     |
| Min reviews before FSRS personalizes | ~1,000                           | FSRS benchmark (falls back to defaults below this)                                          |

**Per-band:** Applies at all levels; most impactful where a stable pattern bank is being built (≤2000).
**Evidence grade:** **A in general learning science, C in chess specifically.** Retrieval practice (Adesope et al. 2017, 272 effects, +0.51 vs restudy), spacing (Cepeda et al. 2006, 839 assessments), and FSRS superiority are all well-replicated — but for verbal/flashcard material, not chess patterns. The Woodpecker Method itself is supported only by author anecdote (Tikkanen's norm run), not controlled trials.
**Key citations:** Roediger & Karpicke (2006), _Psychol Sci_ 17:249–255; Adesope, Trevisan & Sundararajan (2017), _Review of Educational Research_ 87(3):659–701; Cepeda et al. (2006), _Psychol Bull_ 132:354–380; Wilson et al. (2019); open-spaced-repetition FSRS benchmark.
**Confidence/caveats:** Extrapolating from word-list recall to chess pattern recognition is reasonable (both are memory-encoding tasks) but unverified. Flag as best-guess.
**User-facing line:** "Re-solving the puzzles you got wrong, spaced out over days, is the most science-backed way to make patterns stick — even if it's been proven mostly on flashcards, not chess."

---

## Overall Ranking by Evidence-for-Rating-ROI, per Band

Legend: ★★★ = top priority/best-supported; ★ = low priority. Grades in parentheses reflect causal-evidence strength.

| Activity                                                 | <800 | 800–1200 | 1200–1600 | 1600–2000 | 2000–2200 | 2200+ |
| -------------------------------------------------------- | ---- | -------- | --------- | --------- | --------- | ----- |
| Playing rated games (B)                                  | ★★★  | ★★★      | ★★★       | ★★★       | ★★        | ★★    |
| Blunder-check / error reduction (B desc / C train)       | ★★★  | ★★★      | ★★        | ★         | ★         | ★     |
| Tactics (themed, reflective) (B corr / C causal)         | ★★★  | ★★★      | ★★★       | ★★        | ★★        | ★     |
| Spaced review of failed tactics (A gen / C chess)        | ★★   | ★★★      | ★★★       | ★★        | ★★        | ★     |
| Analysing own games (C)                                  | ★★   | ★★       | ★★★       | ★★★       | ★★★       | ★★★   |
| Calculation/visualization (C)                            | ★    | ★        | ★★        | ★★★       | ★★★       | ★★★   |
| Endgame study (C)                                        | ★    | ★        | ★★        | ★★        | ★★★       | ★★★   |
| Master/annotated games (C)                               | ★    | ★        | ★★        | ★★        | ★★★       | ★★★   |
| Coaching (B/C)                                           | ★★   | ★★       | ★★        | ★★★       | ★★★       | ★★★   |
| Opening study (C; D if heavy memorization at low levels) | D    | ★        | ★         | ★★        | ★★★       | ★★★   |

---

## Myths & Low-Evidence Practices to Avoid (Grade D)

- **"Just grind thousands of puzzles and your rating will rise."** Contradicted: r=−0.02 between puzzle volume and closing the puzzle-game gap. Volume without reflection, themes and spacing is wasted.
- **"Memorize deep opening lines to climb at the beginner/intermediate level."** Contradicted by blunder data — sub-1600 games are decided by hanging pieces and missed one-movers, not opening theory.
- **"Blitz/bullet are how you improve."** No support; game-quality analyses and coaching consensus both indicate fast games have low learning value per game (fine in moderation and for fun/sharpness).
- **"Chess training makes you smarter / boosts math (so train for that)."** Transfer is weak and confounded (Sala & Gobet 2016, g=0.34 with no active controls; later active-control studies found no math transfer). Irrelevant to rating; don't market it.
- **"Deliberate practice (10,000 hours) is all it takes."** Contradicted: practice explains only ~26% of game-skill variance (~34% reliable variance for chess); hours-to-master ranged ~3,016–23,608 (Macnamara et al. 2014; Gobet & Campitelli 2007).
- **"The 85% rule is a proven law of human learning."** Overclaim: derived for binary-classification gradient-descent learners; the authors limited its human relevance to perceptual-type learning. Useful heuristic, not law.
- **"de la Maza's 400-points-in-400-days proves tactics-only training works."** Single subject (n=1), heavily confounded (simultaneous heavy play, IM coaching, motivated adult beginner whose early gains match the expected exponential curve), never replicated; he stopped at ~2000 USCF.

---

## Where Evidence Is Thin — Labelled Best-Guess Defaults

Clearly-marked placeholders the app can ship and then A/B test, because no rigorous chess evidence pins the values:

- **[BEST GUESS]** Puzzle difficulty targeting ~80–85% success (from the 85% rule; extrapolated).
- **[BEST GUESS]** Daily tactics dose 10–20 themed puzzles with mandatory reflection.
- **[BEST GUESS]** Spaced-repetition schedule: FSRS defaults, failed puzzles prioritized, expanding intervals; personalization kicks in after ~1,000 reviews.
- **[BEST GUESS]** Time-control mix: ~70–75% rapid/classical, ~25–30% blitz (≈15% if the explicit goal is rapid/classical rating), minimal bullet for improvement-focused users.
- **[BEST GUESS]** Habit cadence: aim for daily short sessions; expect ~2 months (median 66 days, wide range 18–254) before training feels automatic; reward consistency, and avoid contingent tangible rewards that can undermine intrinsic motivation (SDT; Deci, Koestner & Ryan 1999 meta-analysis of 128 experiments).
- **[BEST GUESS]** Band-by-band study allocation (e.g., the often-cited 50% tactics / 30% openings / 10% middlegame / 10% endgame for 1500–2000) is coaching opinion, not data — expose as a tunable default.

---

## Most Important Sources Relied On (with quality notes)

1. **Howard, R. W. (2012)**, _Applied Cognitive Psychology_ 26:359–369. Longitudinal FIDE data, n=533; log(games played) strongest rating predictor, study hours "negligible." _Observational, self-report study hours, methodologically contested — but the best chess-rating-outcome dataset._
2. **Macnamara, Hambrick & Oswald (2014)**, _Psychological Science_ 25:1608–1618. Meta-analysis; deliberate practice = 26% of variance for games. _Large, peer-reviewed; corrected 2018; not a chess-rating intervention._
3. **Gobet & Campitelli (2007)**, _Developmental Psychology_ (and related). ~90+ Buenos Aires club players; r≈0.42 practice↔rating; hours-to-master 3,016–23,608. _Chess-specific, cross-sectional, self-report._
4. **Burgoyne et al. (2016)**, _Intelligence_ 59:72–83 (k=19). Cognitive ability ↔ chess skill r≈0.24 (numerical r=0.35). _Strong, chess-specific; published corrigendum._
5. **Chase & Simon (1973)**, _Cognitive Psychology_ 4:55–81. Foundational chunking/pattern-recognition theory; ~50,000–100,000 chunks for master recall. _Seminal, small-n; mechanism, not training prescription._
6. **chessanalysis.co (2026)**, 2,763-player Lichess analysis; puzzle↔rapid R=0.815, volume-vs-gap r=−0.02, band-by-band blunder data. _Large data analysis, non-peer-reviewed blog; methods disclosed._
7. **Cepeda et al. (2006)**, _Psychological Bulletin_ 132:354–380. Spacing meta-analysis, 839 assessments. _Strong, general (verbal recall), not chess._
8. **Roediger & Karpicke (2006)** + **Adesope et al. (2017)**, _Psychological Science_ 17:249–255 / _Review of Educational Research_ 87:659–701 (272 effects, +0.51 vs restudy). Retrieval/testing effect. _Strong, replicated, general not chess._
9. **Wilson et al. (2019)**, _Nature Communications_ 10:4646. 85% rule. _Rigorous but for ML/perceptual learners; scope-limited._
10. **Sala & Gobet (2016)**, _Educational Research Review_ 18:46–57 (24 studies, 40 effects, N=5,221), g=0.338, no active controls. _Strong design critique; about transfer, not rating._

---

## What Could NOT Be Found With Good Evidence (Honest Gaps)

1. **Any RCT or quasi-experiment showing a training activity causes measured game-rating gain.** This is the central gap — all chess-rating evidence is observational.
2. **Causal proof that tactics/puzzle training raises game rating** (only correlation + consensus).
3. **Any rating-outcome study on calculation/visualization training, own-game analysis, endgame study, opening study, or master-game study individually.** All Grade C.
4. **Chess-pattern-specific validation of spaced-repetition schedulers** (FSRS/SM-2 proven only on flashcard-type recall).
5. **A clean dose-response curve for tournament frequency** isolating games-played from confounds (Howard's data is the closest, and contested).
6. **Experimental confirmation that longer time controls improve learning rate.**
7. **Effect sizes for blunder-check _training_** (only the descriptive blunder-rate-vs-rating relationship is well-measured).
8. **Validated per-band study-mix percentages** — all such splits are coaching/data-blog opinion, not data from controlled trials.
