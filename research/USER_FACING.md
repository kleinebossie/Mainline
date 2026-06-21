# **Scientific Foundation for an Adaptive Chess Training Program: A Cognitive and Behavioral Analysis**

The cognitive science of skill acquisition, memory retention, and habit formation offers a robust, empirically grounded foundation for optimizing chess training. Within the context of an adaptive web application that refers users to external resources (such as Lichess puzzles, books, and endgame trainers) and tracks the results to adapt subsequent sessions, it is crucial to rely on replicated research rather than anecdotal coaching folklore. This analysis synthesizes decades of research from the learning sciences, behavioral psychology, and large-scale data analyses of chess platforms to define the most effective training parameters across all rating levels.

## **Summary: Key Insights and Highest ROI**

Designing an effective curriculum requires a shift from passive consumption to active, friction-rich cognitive processes. The table below presents the insights with the highest degree of certainty and the greatest "Return on Investment" (ROI) for the application's architecture.

| Insight / Principle                      | Scientific Context & Effect Size                                                                                                                                             | Implication for the Application                                                                                                                                |
| :--------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deliberate Practice Is Incomplete**    | "Deliberate practice" explains only 26% to 34% of the performance variance in chess. The time to master level varies enormously (3,000 to 23,000 hours).1                    | The application must not make unrealistic promises based on hours spent. Training must be qualitatively adapted to cognitive capacity, not merely to volume.   |
| **The 85% Rule for Optimal Learning**    | Optimal learning and flow in binary tasks (such as chess puzzles) occurs at an error margin of exactly 15.87%.5                                                              | Algorithms must dynamically calibrate external Lichess puzzle ratings so that the user solves approximately 85% of puzzles correctly.                          |
| **Active Recall (Testing Effect)**       | Active reproduction from memory performs considerably better than passive repetition, with a robust effect size (![][image1]).8                                              | Simply viewing a Stockfish evaluation is ineffective. Mistakes from games must be presented as unaided puzzles 24–48 hours later.                              |
| **Interleaved Practice**                 | Mixing tactical themes feels harder and lowers immediate performance, but doubles long-term retention compared to blocked practice.10                                        | Daily puzzle sessions must consist predominantly of randomly mixed themes (interleaved), unless a specific technique is being learned for the very first time. |
| **FSRS Outperforms Legacy SM-2**         | The Free Spaced Repetition Scheduler (FSRS) algorithm models memory with 21 parameters and requires 20–30% fewer repetitions for the same retention.13                       | Use FSRS v6 for scheduling incorrectly solved puzzles and theoretical opening knowledge, targeting a retention of 85–90%.                                      |
| **Asymptotic Habit Formation**           | It takes on average 66 days to automate a habit. Missing a single day does not materially affect this neurological process.16                                                | Implement grace periods for daily "streaks". Do not excessively punish the user for skipping a day, to prevent demotivation.                                   |
| **Self-Determination Theory (SDT)**      | Sustainable motivation requires autonomy (choice), competence (experience of success), and relatedness.19                                                                    | Always explain to the user openly and honestly _why_ a task is prescribed (radical honesty) to foster autonomous regulation.                                   |
| **Differences in Rating Distributions**  | Lichess puzzle ratings are strongly inflated relative to rapid/blitz ratings (often 500–1000 points higher). Lichess rapid ratings are structurally higher than FIDE/USCF.22 | The app must base puzzle difficulty on the user's historical _puzzle rating_ on the platform, not on their FIDE or blitz rating.                               |
| **Broad Opening Variety for Beginners**  | Large-scale data analysis (1.2 million games) shows that beginners benefit more from opening variety, while early specialization is ineffective.25                           | Discourage deep opening study via spaced repetition for players below 1200 rating; focus them primarily on tactical pattern recognition.                       |
| **Limitations of the Woodpecker Method** | Cyclically and ever-faster repeating the exact same tactical puzzles builds pattern recognition (chunking) but barely improves raw calculation capacity.26                   | Limit closed-set repetition to fundamental patterns. For players above 1600 rating, the majority of tactics time must be spent on unfamiliar puzzles.          |

## **Myths and Practices with Weak Evidence**

To maintain a radically honest, science-based architecture, the application must explicitly avoid or actively debunk several popular theories from coaching folklore. The literature shows that cognitive biases and commercial interests often lead to the adoption of ineffective methods.

| Popular Myth                                | Scientific Reality & Evidence                                                                                                                                                                                                                                                                | Action for the Application                                                                                                                                                  |
| :------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The 10,000-Hour Rule**                    | Originally popularized by a simplification of K. A. Ericsson's work.29 Extensive meta-analyses by Macnamara, Hambrick, and Gobet prove that "deliberate practice" explains at most a third of the performance variance. The required number of hours ranges from 3,000 to more than 23,000.1 | Never promise that quantity (number of puzzles solved) leads linearly to a specific rating. Focus the feedback on the _quality_ of cognitive effort. (Evidence grade: D)    |
| **Blocked Practice (e.g. "Train 50 Pins")** | Blocked practice creates an "illusion of competence". Because the brain holds the solution strategy in working memory, learning appears to go quickly, but transfer to real games fails dramatically.10                                                                                      | Avoid assigning long sessions within a single tactical theme. In real games, no one tells the player that there is a discovered attack in the position. (Evidence grade: D) |
| **Spaced Repetition for Deep Calculation**  | Although algorithms such as FSRS are superior for declarative knowledge (openings, names of squares),34 there is no evidence that repeating the same position increases working-memory capacity for new, unfamiliar calculations.26                                                          | Limit "spaced repetition" to specific theory and fundamental pattern recognition. Calculation skill requires constant exposure to _new_ complications. (Evidence grade: D)  |
| **Habits Form in 21 Days**                  | This myth originates from anecdotes about recovery after plastic surgery. Empirical modeling by Lally et al. (2010) shows a range of 18 to 254 days, with an average of 66 days.16                                                                                                           | Show realistic progress bars based on a trajectory of at least 66 days for automating a daily study habit. (Evidence grade: D)                                              |
| **Visual vs. Auditory Learning Styles**     | There is no robust evidence in learning psychology that tailoring instruction to a "learning style" improves outcomes. Semantic processing (meaning-making and active recall) drives retention.37                                                                                            | Do not offer pseudo-scientific tests for "learning styles". Direct all efforts toward "desirable difficulties". (Evidence grade: D)                                         |

## **Where the Evidence Is Thin: Best-Guess Standards**

Cognitive science has gaps, particularly regarding digital chess adaptations. Where direct evidence is lacking, the application must transparently rely on extrapolated principles and clearly communicate this uncertainty.

| Domain with Limited Evidence             | Reasoning and Extrapolated Approach                                                                                                                                                                                                         | Safe "Best-Guess" Placeholder                                                                                                                                                  |
| :--------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Optimal Daily Session Duration**       | "Spaced learning" proves that distributed practice is better than blocks,39 but the exact optimal number of minutes for adults playing chess is unknown.                                                                                    | Default 20–30 minutes. This aligns with general cognitive-load limits and standard Pomodoro intervals, preventing fatigue.                                                     |
| **Transfer from Perception to Strategy** | The 85% rule is strongly validated for perceptual learning and classification (e.g. bird-watching, medical scans).5 How this translates to complex, strategic planning (multiple moves deep) has not been empirically established in chess. | Apply the 85% rule strictly to tactical Lichess puzzles. However, allow a lower success rate (e.g. 60–70%) for deep, strategic complexity that requires prolonged calculation. |
| **Centipawn Loss as a Learning Metric**  | Neural networks evaluate positions to perfection (e.g. Stockfish), but there is no empirical framework showing that blindly pursuing minimal "centipawn loss" improves human cognition or strategy in the long term.41                      | Use centipawn loss solely as an extraction mechanism to filter critical mistakes from games (>200 loss) for later "active recall", not as a primary target for the learner.    |

## **Deep Analysis 1: Task Calibration and the 85% Rule**

The application must continuously calibrate the difficulty of external resources (such as the Lichess puzzles retrieved via API) to match the user's current cognitive capacity. Tasks that are too easy facilitate no learning ("ceiling effect"); tasks that are too hard induce frustration and cognitive overload ("floor effect").  
The research by Wilson et al. (2019), published in _Nature Communications_, formalizes this concept mathematically. They showed that in binary learning tasks—where an answer is correct or incorrect, analogous to chess tactics—the learning rate is maximized at an error margin of precisely 15.87%.5 This 85% success rule enables the brain to extract sufficient new information (the gradient of learning) from failures while simultaneously maintaining "flow" and autonomous motivation. Because failure can be ego-threatening, leading to the abandonment of the learning attempt,5 it is crucial not to needlessly tax the user's frustration tolerance.  
A complicating factor in chess is the massive inflation and divergence of rating systems. Data models from ChessGoals, based on more than 9,000 profiles, show that a player with a Chess.com rapid rating of 1400 typically has a Lichess puzzle rating between 2000 and 2400.22 Directly linking game rating to puzzle rating leads to extreme cognitive mismatch. The application must calibrate based on platform-specific performance rather than overarching game ratings.

### **Recommendation & Parameters**

The application must dynamically steer the URL parameters for Lichess (?rating=XXXX) to achieve an expected score of 0.85.

| Parameter                 | Specification                                                                                                         |
| :------------------------ | :-------------------------------------------------------------------------------------------------------------------- |
| **Target Success Rate**   | 85% (15% error margin).                                                                                               |
| **Lichess Rating Offset** | Request puzzles roughly 100–150 points _lower_ than the user's current historical puzzle rating to hit the 85% ratio. |
| **Dynamic Adjustment**    | If the rolling 7-day success rate is > 90%, raise the target rating by 50 points. If < 80%, lower it by 50 points.    |

### **Notes per Rating Level**

- **<800 (Beginners):** Lean toward a success rate of 90%. Beginners lack frustration tolerance and run a considerably higher risk of dropout due to ego-threatening failures.5
- **800–1600:** Strictly adhere to the 85% algorithm. This is the phase in which tactical pattern recognition dominates the game.27
- **1600–2000+:** Accept dips to 70–80% when the user is faced with complex calculation exercises (rather than direct pattern recognition). Advanced players possess stronger autonomous regulation (as defined by SDT) to endure frustration.21

### **Evidence Grade & Key Citations**

- **Evidence Grade:** A (Strong, replicated evidence in mathematical modeling and cognitive psychology).
- **Key Citations:** Wilson, R. C., Shenhav, A., Straccia, M., & Cohen, J. D. (2019). _The Eighty Five Percent Rule for optimal learning._ Nature Communications, 10, 4646\.5.

### **User-Facing Rationale ("Why this?")**

**Why do these puzzles feel relatively doable?** Research from neuroscience (_Nature Communications_, Wilson 2019\) proves that your brain absorbs new patterns fastest when you get it right 85% of the time. If we make it too easy (100%), you learn nothing; if we make it too hard (50%), the learning process stalls and you get frustrated. We steer you toward a difficulty perfectly calibrated to push your limits without breaking your confidence. (Evidence grade: A)

## **Deep Analysis 2: The Modality of Practice (Interleaved vs. Blocked Practice)**

The way exercises are ordered—the chronological structure of a training session—determines whether information is stored for temporary use or for long-term, contextual application. When referring to tactical training via Lichess themes, the choice between blocked and interleaved methods is decisive.  
Blocked practice means that a player isolates one specific problem type (for example, practicing only pins). Because the underlying concept remains in working memory, the student performs extremely well during the practice session. This creates a robust but dangerous "illusion of competence".10 However, in the cognitive literature, researchers such as Bjork and Rohrer have irrefutably proven that "interleaving"—constantly switching between different kinds of concepts (a pin, then a discovered attack, then a fork)—leads to considerably superior long-term retention.12 Although interleaving initially lowers performance during the session (a "desirable difficulty"), it teaches the brain to _discriminate_. In the context of a real chess game, identifying _which_ tactical motif applies is often harder than executing the motif itself.33

### **Recommendation & Parameters**

The application must generate daily training suggestions that lean heavily on interleaving. The configuration may permit blocked practice only for the very first introduction of an entirely new concept.

| Parameter                        | Specification                                                                                                                                        |
| :------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Blocked Ratio (Acquisition)**  | At most 10–20% of the prescribed puzzle time. To be used only when a player is learning a new theme (e.g. "smothered mate") via Lichess.             |
| **Interleaved Ratio (Transfer)** | 80–90% of the prescribed puzzle time. Direct the player to the generic "Mix" setting on Lichess or a random selection of previously acquired themes. |
| **Feedback Mechanisms**          | Lower the expected success rate by 5% during interleaved practice to compensate for the increased cognitive load.                                    |

### **Notes per Rating Level**

- **<800:** Use up to 30% blocked practice. Novices lack the fundamental "vocabulary" of chess patterns (what even is a fork?). Before they can discriminate between concepts, they must first absorb the concepts in isolation.12
- **800–2000+:** 95% interleaved practice. Mistakes at this level rarely stem from ignorance of how a discovered attack works, but from failing to recognize the cues in the position that point to the possibility.27 Interleaving forces the player to scan the cues (anchors).

### **Evidence Grade & Key Citations**

- **Evidence Grade:** A (Extensive meta-analyses, supported by Bjork's New Theory of Disuse).
- **Key Citations:** Bjork, R. A., & Bjork, E. L. (2011). *Making things hard on yourself, but in a good way: Creating desirable difficulties to enhance learning.*10. Rohrer, D., et al. (2010). *Applied Cognitive Psychology.*12.

### **User-Facing Rationale ("Why this?")**

**Why do you get a random mix of puzzles instead of one specific theme?** Doing 50 "pin" puzzles in a row feels very productive, but it creates a false sense of mastery. Because you already know the answer is a pin, you don't really have to think. By mixing themes (interleaving) we train your brain to determine _which_ tactic is hidden in the position. This is exactly what you have to do during a real game. It feels harder, but research shows it doubles your learning return. (Evidence grade: A, Bjork & Bjork)

## **Deep Analysis 3: Repetition Schedules (The FSRS Algorithm)**

To anchor openings or crucial endgames in long-term memory (such as the theoretical Lucena and Philidor positions), regular repetition is needed. However, not every repetition frequency is created equal.  
The phenomenon of the "spacing effect"—discovered by Ebbinghaus and confirmed in the massive Cepeda meta-analysis of 2006 (839 assessments, 317 experiments)—holds that longer intervals between learning sessions lead to more robust memory traces compared to massed "cramming" (blocking).39 Whereas for decades the SM-2 algorithm (known from Anki) was the standard, recent machine-learning innovation has changed the landscape.  
The Free Spaced Repetition Scheduler (FSRS) is based on the Three-Component Model of Memory and considerably outperforms SM-2.13 FSRS uses 21 optimizable parameters to compute Retrievability (![][image2], the probability of successful recall), Stability (![][image3], the number of days until ![][image2] drops to 90%), and Difficulty (![][image4], the intrinsic complexity of the position). Large-scale benchmarks show that FSRS requires 20% to 30% fewer repetitions to reach the same target retention (often around 85–90%) than older algorithms.14

### **Recommendation & Parameters**

The application must integrate the FSRS v6 mathematical model into the scheduling of external positions to be repeated, or advise the user to use tools that employ such modern algorithms.

| Parameter                          | Specification                                                                                                                                                           |
| :--------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Algorithm Core**                 | FSRS v6 (Free Spaced Repetition Scheduler).                                                                                                                             |
| **Target Retention (![][image2])** | 85% to at most 90%. (Forcing retention above 90% leads to an exponential increase in repetition load and user dropout without meaningful gains in chess performance.)14 |
| **Application Domain**             | Theoretical endgames, opening repertoires, and (specifically filtered) recently failed Lichess puzzles.                                                                 |

### **Notes per Rating Level**

- **<1200:** Avoid using spaced repetition for deep opening study. Datasets show that beginners do not lose through opening deviations, but through outright blunders.27 Use FSRS solely to automate basic tactics and square recognition.
- **1200–2000:** Actively apply FSRS to reviewing crucial defensive mechanisms, complex tactical motifs that failed in earlier sessions, and the incremental build-out of opening lines.34
- **2000+:** High returns for complex opening theory where move order matters extremely precisely, facilitated via FSRS.54

### **Evidence Grade & Key Citations**

- **Evidence Grade:** A (Demonstrated by billions of logged flashcard recalls and robust parameter optimization).
- **Key Citations:** Ye, J. (Development and benchmark testing of FSRS).13. Cepeda, N. J., et al. (2006). _Distributed practice in verbal recall tasks: A review and quantitative synthesis._ Psychological Bulletin.39.

### **User-Facing Rationale ("Why this?")**

**Why are you seeing this failed puzzle or opening again today?** We use FSRS, the most advanced memory algorithm in the world, based on artificial intelligence. It predicts the exact moment your brain is about to forget this position. By forcing you to recall the position right now, we anchor it in your long-term memory, saving you 20% of study time compared to traditional methods. (Evidence grade: A, Ye / Cepeda et al., 2006\)

## **Deep Analysis 4: Active Recall in Game Analysis**

A critical moment for chess development is the post-mortem analysis of games played. The standard habit of online players is to immediately switch on the engine (such as Stockfish on Lichess or Chess.com) and follow the arrows on the board.57 This constitutes a massive didactic failure.  
A meta-analysis by Adesope et al. (2017), based on 272 independent studies, irrefutably shows that simply rereading information (passive exposure) is significantly inferior to "active recall" (the "testing effect").8 When a chess player reads an engine evaluation ("ah, the engine plays Bh7+"), this requires no cognitive reconstruction. No memory strengthening occurs, since the brain does not struggle with the retrieval phase from working memory.58 To truly learn from mistakes, the erroneous position must be isolated and, preferably after some delay, presented to the player as an unaided puzzle (blind to engine feedback).

### **Recommendation & Parameters**

The application must break the mechanism of passive engine consumption. Via API connections, critical moments from recently played Lichess games must be isolated and, after a deliberately built-in delay, offered for active recall.

| Parameter                 | Specification                                                                                                                                                                        |
| :------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Extraction Filter**     | Select 1 to at most 3 mistakes per game played, based on a substantial drop in objective evaluation (e.g. centipawn loss > 200) or a missed win (change from equal to +3 or higher). |
| **Time Interval (Delay)** | Present the extracted positions 24 to 48 hours _after_ the game has ended in order to tax long-term memory.                                                                          |
| **Format**                | Present the position as a regular tactical puzzle. The engine evaluation remains strictly hidden until the player makes a move or explicitly requests a hint.                        |

### **Notes per Rating Level**

- **<1200:** Filter solely on one-move blunders, such as directly giving away material (e.g. an undefended rook).27 Analyzing positional finesses is noise at this level.
- **1200–1800:** Extrapolate missed tactical sequences (2- or 3-move combinations).
- **1800+:** In addition to tactics, extract decision moments in imbalances, including missed prophylaxis or strategic positional advantages.60

### **Evidence Grade & Key Citations**

- **Evidence Grade:** A (Robustly replicated across cognitive laboratories and applied educational practice, large effect size).
- **Key Citations:** Adesope, O. O., et al. (2017). _Rethinking the Use of Tests: A Meta-Analysis of Practice Testing._ Review of Educational Research, 87(3).8.

### **User-Facing Rationale ("Why this?")**

**Why don't we analyze your games with the engine on right away?** By pressing the "analysis" button after your game and following the computer arrows, you create the illusion that you understand the position. Cognitive science calls this passive repetition, and it yields almost no learning return. We've filtered out your worst mistakes from yesterday and force you to dig the solution out of your own memory or insight today ("active recall"). That mental friction is exactly where your chess level rises. (Evidence grade: A, Adesope et al.)

## **Deep Analysis 5: Deliberate Practice and the Woodpecker Method**

The pursuit of chess mastery is popularly linked to the "10,000-hour rule", derived from early interpretations of K. A. Ericsson's theory of deliberate practice.29 Ericsson claimed that nearly all variance in expert performance can be explained by the hours invested in highly structured, feedback-rich training.  
Recent, much more rigorous meta-analyses by Hambrick, Macnamara, and Oswald (2014), however, irrefutably prove that deliberate practice explains only some 26% to 34% of performance variance in games and chess.1 This leaves the vast majority of success to other factors, including genetics, working memory, intelligence, and starting age. Gobet and Campitelli (2007) analyzed 104 Argentine chess players and found absurd variations in the time to reach the master title: the fastest player took 3,000 hours, the slowest more than 23,000.4 More (quantity) is therefore decidedly not automatically better.  
Within this debate sits the "Woodpecker Method" of the Swedish GMs Tikkanen and Smith. This method prescribes that players solve a specific set of (for example 1,000) tactical puzzles and then redo the _exact_ sequence in half the time, and so on, until the set is completed in a single day.26 Proponents base themselves on the "chunking" theory of de Groot, Chase, Simon, and Gobet:66 the brain of an expert does not calculate every move but recognizes geometric patterns (chunks) directly. Critics, however, point to "overfitting": simply memorizing the answer to the specific puzzle, without developing transferable skills in unfamiliar positions (calculation ability).26

### **Recommendation & Parameters**

The application must facilitate a heavily abbreviated variant of the Woodpecker logic to automate basic pattern recognition (chunking) without obstructing the development of raw calculation skills.

| Parameter                     | Specification                                                                                                                                                      |
| :---------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Set Size**                  | At most 100 to 200 fundamental, relatively simple puzzles (not 10-move-deep mates).                                                                                |
| **Time Reduction per Cycle**  | Cycle 1: No time limit. Cycle 2: Aim for 50% of the initial solving time. Cycle 3: Aim for 25%. Stop after at most 3–4 iterations.                                 |
| **Balance with New Material** | Assign no more than 30% of the weekly tactical training load to Woodpecker repetitions; reserve at least 70% for exposure to entirely _new_, unfamiliar positions. |

### **Notes per Rating Level**

- **<1200:** High ROI for closed-set repetition. This group loses because they don't immediately see basic geometries (discovered attacks, scholar's-mate structures). Repetition anchors this visual alphabet.12
- **1200–1800:** Moderate ROI. Use repetition solely for rarer, complex themes that refuse to settle into the subconscious.
- **1800+:** Very low ROI. At this level, virtually all tactical "chunks" are internalized. To reach master level, attention must shift to increasing the depth of the raw calculation tree in entirely unfamiliar waters.26

### **Evidence Grade & Key Citations**

- **Evidence Grade:** B (The theory around pattern recognition/chunking is extremely robust and Grade A \[Chase/Simon/Gobet\], but the specific cycle protocols of the Woodpecker Method are largely based on anecdotes and lack formal randomized controlled studies.)26.
- **Key Citations:** Gobet, F., & Campitelli, G. (2007). _The role of domain-specific practice, handedness, and starting age in chess._ Developmental Psychology.4. Tikkanen, H., & Smith, A. (2018). *The Woodpecker Method.*27.

### **User-Facing Rationale ("Why this?")**

**Why do we have you solve puzzles you already got right last month?** Grandmasters don't calculate every individual move; their brains store geometric patterns as recognizable units (chunks) and respond intuitively. By cyclically repeating a core set of puzzles several times, we force the solution out of your slow working memory ("I have to calculate") and into your fast instinct ("I see it immediately"). (Evidence grade: B, theory of Chase/Simon/Gobet)

## **Deep Analysis 6: Habit Formation and Motivation (SDT)**

Even the most scientifically optimized algorithm is worthless if the user drops out (churn). Behavioral science around habituation and intrinsic motivation must be deeply embedded in the user interface and the progress metrics.  
From the perspective of Self-Determination Theory (SDT), formulated by Deci & Ryan, sustainable motivation requires the fulfillment of three basic psychological needs: Autonomy, Competence, and Relatedness.19 Within the app context, Autonomy is crucial. If a user blindly performs tasks for extrinsic points (gamification), the quality of cognitive effort declines. When the user understands _why_ a method works (integrated and identified regulation), however, motivation transforms into autonomous motivation.21  
In the field of pure neurological habit formation, a highly influential longitudinal study by Lally et al. (2010) debunks myths. The popular belief that it takes 21 days to form a habit is false. Lally proved, via asymptotic growth models, that it takes on average 66 days before an action becomes automatic.16 Even more fundamental for app design: Lally showed that an occasional missed day does _not_ harm or reset the development of the neural pathway.17 The use of unforgiving "streak-reset" mechanisms by many educational platforms (where one missed day sets the counter to zero) creates disproportionate psychological demotivation and directly contradicts behavioral science.

### **Recommendation & Parameters**

The application must redesign progression systems to satisfy the findings of Lally (asymptotic forgiveness) and Deci & Ryan (radical transparency).

| Parameter              | Specification                                                                                                                                                                     |
| :--------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Habituation Metric** | Use a 66-day reference frame for reaching an "automated habit", displayed as a gently rising asymptote rather than a hard boundary.                                               |
| **Streak Forgiveness** | Implement a built-in grace system ("grace period"). Missing one or two days results in stagnation of progress, _never_ in a punitive reset to zero.                               |
| **Autonomy Support**   | Integrate a "Scientific Explanation" dropdown with each assigned session. SDT shows that revealing the underlying purpose converts extrinsic friction into autonomous acceptance. |

### **Notes per Rating Level**

- **All Rating Levels:** Basic human behavior and psychological needs transcend rating bands. These principles must be applied uniformly across the entire platform.

### **Evidence Grade & Key Citations**

- **Evidence Grade:** A (Highly cited, replicated behavioral modeling and macro-theories within psychology).
- **Key Citations:** Lally, P., et al. (2010). _How are habits formed: Modelling habit formation in the real world._ European Journal of Social Psychology.17. Ryan, R. M., & Deci, E. L. (2020). *Intrinsic and extrinsic motivation from a self-determination theory perspective.*19.

### **User-Facing Rationale ("Why this?")**

**Why don't you lose your "streak" after a rest day?** According to the classic behavioral study by Lally et al. (2010), it takes on average 66 days to automate a habit, and a missed day affects that process in your brain almost not at all. Strict streak counters on other apps play on loss aversion, which leads to demotivation and giving up once things go wrong. We follow the science: long-term consistency is what counts, not the obsessive tracking of perfect days. (Evidence grade: A, Lally et al. / SDT)

## **Overview of Key Literature Sources & Identification of Gaps**

The methodology for this application is firmly anchored in the primary scientific literature. Below is the selection of the most fundamental studies that feed the architectural design, as well as the areas where robust evidence is structurally lacking.

1. **Macnamara, Hambrick, & Oswald (2014) / Hambrick et al. (2014):** Large meta-analyses (157 effect sizes, N \> 11,000) showing that deliberate practice explains only \~26–34% of performance in games. Rigorously debunks the popularity of the 10,000-hour rule.1
2. **Bjork & Bjork (2011) / Rohrer et al. (2010):** The canonical texts on "Desirable Difficulties" and interleaving. Experimental evidence with robust samples showing that blocked practice is illusory and interleaved practice guarantees superior transfer.10
3. **Wilson et al. (2019):** Published in _Nature Communications_. The paper that mathematically formalizes the 15.87% error rate for the maximal gradient of perceptual and machine learning (the 85% rule).5
4. **Adesope et al. (2017):** Extensive meta-analysis (272 studies) confirming the testing effect (active recall). It shows large variance across effect sizes, converging on a ![][image1] advantage over restudying.8
5. **Ye, J. et al. (FSRS Documentation):** Data-science research based on hundreds of millions of flashcard usage logs, mathematically proving how the 21 parameters of FSRS model retention far more efficiently than SM-2.13
6. **Lally et al. (2010):** Longitudinal field study on habit formation (12 weeks, 96 participants) that exposed the asymptotic curve and the 66-day average.16
7. **Gobet & Campitelli (2007):** Chess-specific empirical analysis (N=104) documenting extreme individual variance in time toward mastery and quantifying the role of starting age.4
8. **Deci & Ryan (2000, 2020):** The globally accepted theoretical foundation (SDT) on motivation and the effects of basic psychological needs on perseverance.19

### **Missing Evidence (Flagged Friction Zones)**

Strong convictions prevail in the chess world for which simply no high-quality randomized controlled (RCT) scientific evidence (Grade A) can be found.

- _Direct link between Spaced Repetition and Calculation Power:_ Although algorithms work excellently for openings (vocabulary memory), evidence is lacking that repeating specific tactical complexities actually increases the brain's general, dynamic tree-structure of _calculation skill_ in entirely unfamiliar waters faster than random, new positions.
- _Centipawn minimization in relation to cognitive growth:_ Beyond the identification of gross mistakes (\>200 centipawn loss), there is no scientific literature showing that adults acquire chess insight more efficiently by constantly pursuing positions with small, engine-defined finesses (+0.4 to \+0.1).

#### **Works Cited**

1. Facing facts about deliberate practice \- Frontiers, [https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2014.00751/full](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2014.00751/full)
2. Deliberate Practice and Performance in Music, Games, Sports, Education, and Professions: A Meta-Analysis \- College of Health and Human Sciences, [https://hhs.purdue.edu/skill-learning-and-performance-lab/wp-content/uploads/sites/43/2024/08/macnamara-et-al-2014-deliberate-practice-and-performance-in-music-games-sports-education-and-professions-a-meta-analysis.pdf](https://hhs.purdue.edu/skill-learning-and-performance-lab/wp-content/uploads/sites/43/2024/08/macnamara-et-al-2014-deliberate-practice-and-performance-in-music-games-sports-education-and-professions-a-meta-analysis.pdf)
3. The role of deliberate practice in expertise: Necessary but not sufficient \- ResearchGate, [https://www.researchgate.net/publication/49400707_The_role_of_deliberate_practice_in_expertise_Necessary_but_not_sufficient](https://www.researchgate.net/publication/49400707_The_role_of_deliberate_practice_in_expertise_Necessary_but_not_sufficient)
4. The role of domain-specific practice, handedness, and starting age in chess \- PubMed, [https://pubmed.ncbi.nlm.nih.gov/17201516/](https://pubmed.ncbi.nlm.nih.gov/17201516/)
5. Perfecting your Phish Simulations — The 85% Sweet Spot for Optimal Learning, [https://cyberbites.medium.com/perfecting-your-phish-simulations-the-85-sweet-spot-for-optimal-learning-53234382190b](https://cyberbites.medium.com/perfecting-your-phish-simulations-the-85-sweet-spot-for-optimal-learning-53234382190b)
6. If You Want to Improve Learning, Try the 85% Rule \- Eller Executive Education, [https://executive.eller.arizona.edu/news/2019/12/if-you-want-improve-learning-try-85-rule](https://executive.eller.arizona.edu/news/2019/12/if-you-want-improve-learning-try-85-rule)
7. 85% Rule of Optimal Learning \- by Drenizë Rama \- Medium, [https://medium.com/@drenizerama/85-rule-of-optimal-learning-15581eca9842](https://medium.com/@drenizerama/85-rule-of-optimal-learning-15581eca9842)
8. The Use of Retrieval Practice in the Health Professions: A State-of-the-Art Review \- PMC, [https://pmc.ncbi.nlm.nih.gov/articles/PMC12292765/](https://pmc.ncbi.nlm.nih.gov/articles/PMC12292765/)
9. A Meta-Analytic Review of the Benefit of Spacing out Retrieval Practice Episodes on Retention, [http://www.lscp.net/persons/ramus/docs/EPR20.pdf](http://www.lscp.net/persons/ramus/docs/EPR20.pdf)
10. Desirable Difficulties: Why Effortful Learning Outlasts Easy Learning | Glasp, [https://glasp.co/articles/desirable-difficulties](https://glasp.co/articles/desirable-difficulties)
11. Desirable Difficulties: Why Making Learning Harder Helps You \- Mindomax, [https://www.mindomax.com/desirable-difficulties](https://www.mindomax.com/desirable-difficulties)
12. What Is Interleaved Learning Used For With eLearning? \- Neovation Learning Solutions, [https://www.neovation.com/learn/22-what-is-interleaved-learning](https://www.neovation.com/learn/22-what-is-interleaved-learning)
13. The FSRS Spaced Repetition Algorithm \- RemNote Help Center, [https://help.remnote.com/en/articles/9124137-the-fsrs-spaced-repetition-algorithm](https://help.remnote.com/en/articles/9124137-the-fsrs-spaced-repetition-algorithm)
14. ABC of FSRS · open-spaced-repetition/awesome-fsrs Wiki \- GitHub, [https://github.com/open-spaced-repetition/awesome-fsrs/wiki/ABC-of-FSRS](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/ABC-of-FSRS)
15. FSRS vs SM2 Spaced Repetition Algorithm \- Mindomax, [https://www.mindomax.com/fsrs-vs-sm2-spaced-repetition-algorithm](https://www.mindomax.com/fsrs-vs-sm2-spaced-repetition-algorithm)
16. How Are Habits Formed? The Psychology of Habit Formation, [https://positivepsychology.com/how-habits-are-formed/](https://positivepsychology.com/how-habits-are-formed/)
17. Modelling Habit Formation: Insights from Eur. J. Soc. Psychol. 40 (2010) \- Studocu, [https://www.studocu.vn/vn/document/truong-dai-hoc-ngoai-ngu-dai-hoc-da-nang/ngon-ngu-anh/modelling-habit-formation-insights-from-eur-j-soc-psychol-40-2010/157504686](https://www.studocu.vn/vn/document/truong-dai-hoc-ngoai-ngu-dai-hoc-da-nang/ngon-ngu-anh/modelling-habit-formation-insights-from-eur-j-soc-psychol-40-2010/157504686)
18. Making health habitual: the psychology of 'habit-formation' and general practice \- PMC, [https://pmc.ncbi.nlm.nih.gov/articles/PMC3505409/](https://pmc.ncbi.nlm.nih.gov/articles/PMC3505409/)
19. Article recommendation: Intrinsic and extrinsic motivation \- Kappan Online, [https://kappanonline.org/miles-ciannella-ryan-deci-motivation/](https://kappanonline.org/miles-ciannella-ryan-deci-motivation/)
20. The Psychology of Online Education: Applying Self-Determination Theory for Better Outcomes | University of Phoenix, [https://www.phoenix.edu/research/news/2025/psychology-of-online-education-applying-self-determination.html](https://www.phoenix.edu/research/news/2025/psychology-of-online-education-applying-self-determination.html)
21. Self-Determination Theory \- selfdeterminationtheory.org, [https://selfdeterminationtheory.org/wp-content/uploads/2023/01/2022_RyanDeci_SDT_Encyclopedia.pdf](https://selfdeterminationtheory.org/wp-content/uploads/2023/01/2022_RyanDeci_SDT_Encyclopedia.pdf)
22. Chess Rating Comparison – ChessGoals.com, [https://chessgoals.com/rating-comparison/](https://chessgoals.com/rating-comparison/)
23. What's your puzzles rating, and how does it compare to your actual rating? : r/chess \- Reddit, [https://www.reddit.com/r/chess/comments/1dvzyhq/whats_your_puzzles_rating_and_how_does_it_compare/](https://www.reddit.com/r/chess/comments/1dvzyhq/whats_your_puzzles_rating_and_how_does_it_compare/)
24. Correlation between your best puzzle rating and your rapid rating \- hope it's interesting\! : r/chessbeginners \- Reddit, [https://www.reddit.com/r/chessbeginners/comments/l4z6mw/correlation_between_your_best_puzzle_rating_and/](https://www.reddit.com/r/chessbeginners/comments/l4z6mw/correlation_between_your_best_puzzle_rating_and/)
25. Quantifying human performance in chess \- PMC \- NIH, [https://pmc.ncbi.nlm.nih.gov/articles/PMC9902564/](https://pmc.ncbi.nlm.nih.gov/articles/PMC9902564/)
26. CheckRaiseMate's Blog • The Woodpecker Method, Revisited \- Lichess.org, [https://lichess.org/@/CheckRaiseMate/blog/the-woodpecker-method-revisited/ClV6CvGE](https://lichess.org/@/CheckRaiseMate/blog/the-woodpecker-method-revisited/ClV6CvGE)
27. Upgrade Your Chess Game With The Woodpecker Method, [https://www.uscfsales.com/blogs/chess-strategies/upgrade-your-chess-game-with-the-woodpecker-method](https://www.uscfsales.com/blogs/chess-strategies/upgrade-your-chess-game-with-the-woodpecker-method)
28. Learning science \- do we trust the chessable learning algorithm?, [https://www.chessable.com/discussion/thread/133795/learning-science-do-we-trust-the-chessable-learning-algorithm/137439/](https://www.chessable.com/discussion/thread/133795/learning-science-do-we-trust-the-chessable-learning-algorithm/137439/)
29. Is the Deliberate Practice View Defensible? A Review of Evidence and Discussion of Issues, [https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2020.01134/full](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2020.01134/full)
30. Deliberate practice: Is that all it takes to become an expert? \- Gwern.net, [https://gwern.net/doc/psychology/chess/2014-hambrick.pdf](https://gwern.net/doc/psychology/chess/2014-hambrick.pdf)
31. The Relationship Between Deliberate Practice and Performance in Sports \- Case Western Reserve University, [https://artscimedia.case.edu/wp-content/uploads/sites/141/2016/09/14214856/Macnamara-Moreau-Hambrick-2016.pdf](https://artscimedia.case.edu/wp-content/uploads/sites/141/2016/09/14214856/Macnamara-Moreau-Hambrick-2016.pdf)
32. Mastering chess: Deliberate practice is necessary but not sufficient, psychologists find, [https://www.sciencedaily.com/releases/2011/10/111024153448.htm](https://www.sciencedaily.com/releases/2011/10/111024153448.htm)
33. Download our Interleaving Practice Guide\! \- RetrievalPractice.org, [https://www.retrievalpractice.org/strategies/2017/interleaving](https://www.retrievalpractice.org/strategies/2017/interleaving)
34. CheckRaiseMate's Blog • Spaced Repetition \- Lichess.org, [https://lichess.org/@/CheckRaiseMate/blog/spaced-repetition/eteyH8MT](https://lichess.org/@/CheckRaiseMate/blog/spaced-repetition/eteyH8MT)
35. Spaced repetition memory system \- Andy Matuschak's notes, [https://notes.andymatuschak.org/Spaced_repetition_memory_system](https://notes.andymatuschak.org/Spaced_repetition_memory_system)
36. Habit Formation: building automatic positive behaviors (Coachbit), [https://coachbit.com/glossary/habit-formation](https://coachbit.com/glossary/habit-formation)
37. How to use cognitive psychology to enhance learning \- Teaching in Higher Ed, [https://teachinginhighered.com/podcast/cognitive-psychology/](https://teachinginhighered.com/podcast/cognitive-psychology/)
38. Interleaving Effect | FunBlocks AI, [https://www.funblocks.net/thinking-matters/classic-mental-models/interleaving-effect](https://www.funblocks.net/thinking-matters/classic-mental-models/interleaving-effect)
39. Parallels between spacing effects during behavioral and cellular learning \- PMC \- NIH, [https://pmc.ncbi.nlm.nih.gov/articles/PMC3390592/](https://pmc.ncbi.nlm.nih.gov/articles/PMC3390592/)
40. Why Spaced Repetition Beats Cramming (The Spacing Effect) | TrainMeUK, [https://trainmeuk.co.uk/resources/spacing-effect-spaced-repetition-beats-cramming](https://trainmeuk.co.uk/resources/spacing-effect-spaced-repetition-beats-cramming)
41. chess engine analysis improvement request \- Lichess.org, [https://lichess.org/forum/lichess-feedback/chess-engine-analysis-improvement-request](https://lichess.org/forum/lichess-feedback/chess-engine-analysis-improvement-request)
42. Chess Rating Estimation from Moves and Clock Times Using a CNN-LSTM \- arXiv, [https://arxiv.org/html/2409.11506v2](https://arxiv.org/html/2409.11506v2)
43. Enforcing a high success percentage interferes with reward-based motor learning \- PMC, [https://pmc.ncbi.nlm.nih.gov/articles/PMC13031413/](https://pmc.ncbi.nlm.nih.gov/articles/PMC13031413/)
44. Low Correlation between Puzzle Proficiency & Rating \- Implications for Chess Improvement? \- Lichess.org, [https://lichess.org/forum/general-chess-discussion/low-correlation-between-puzzle-proficiency--rating-implications-for-chess-improvement](https://lichess.org/forum/general-chess-discussion/low-correlation-between-puzzle-proficiency--rating-implications-for-chess-improvement)
45. Ryan and Deci 2020 self determination theory.pdf \- stial.ie | Enabling Futures, [https://stial.ie/resources/Ryan%20and%20Deci%202020%20self%20determination%20theory.pdf](https://stial.ie/resources/Ryan%20and%20Deci%202020%20self%20determination%20theory.pdf)
46. (PDF) The Current State of the Gamification in E-Learning \- ResearchGate, [https://www.researchgate.net/publication/338126590_The_Current_State_of_the_Gamification_in_E-Learning](https://www.researchgate.net/publication/338126590_The_Current_State_of_the_Gamification_in_E-Learning)
47. Desirable Difficulties: Bjork's 5 Principles \- Structural Learning, [https://www.structural-learning.com/post/desirable-difficulties](https://www.structural-learning.com/post/desirable-difficulties)
48. TheOnoZone's Blog • What's the Point of Puzzles? \- Lichess.org, [https://lichess.org/@/TheOnoZone/blog/whats-the-point-of-puzzles/biZe93DT](https://lichess.org/@/TheOnoZone/blog/whats-the-point-of-puzzles/biZe93DT)
49. Cepeda, Pashler, Vul, Wixted, and Rohrer, 2006 \- York University, [https://www.yorku.ca/ncepeda/publications/CPVWR2006.html?utm_source=chatgpt.com](https://www.yorku.ca/ncepeda/publications/CPVWR2006.html?utm_source=chatgpt.com)
50. Spacing effect \- Wikipedia, [https://en.wikipedia.org/wiki/Spacing_effect](https://en.wikipedia.org/wiki/Spacing_effect)
51. What spaced repetition algorithm does Anki use?, [https://faqs.ankiweb.net/what-spaced-repetition-algorithm](https://faqs.ankiweb.net/what-spaced-repetition-algorithm)
52. A technical explanation of FSRS \- Expertium's Blog | Spaced repetition stuff, [https://expertium.github.io/Algorithm.html](https://expertium.github.io/Algorithm.html)
53. Using Spaced Repetition Intelligently – Chessable Blog, [https://www.chessable.com/blog/using-spaced-repetition-intelligently/](https://www.chessable.com/blog/using-spaced-repetition-intelligently/)
54. How effective are theory tables? \- Chess Stack Exchange, [https://chess.stackexchange.com/questions/41458/how-effective-are-theory-tables](https://chess.stackexchange.com/questions/41458/how-effective-are-theory-tables)
55. Chessable \- Where Science Meets Chess, [https://www.chessable.com/](https://www.chessable.com/)
56. Spacing effects in learning: A temporal ridgeline of optimal retention \- eScholarship.org, [https://escholarship.org/content/qt0kp5q19x/qt0kp5q19x.pdf](https://escholarship.org/content/qt0kp5q19x/qt0kp5q19x.pdf)
57. Is there a systematic way to use Lichess to improve? (Not new to chess, just new to sites), [https://www.reddit.com/r/lichess/comments/1qgjf22/is_there_a_systematic_way_to_use_lichess_to/](https://www.reddit.com/r/lichess/comments/1qgjf22/is_there_a_systematic_way_to_use_lichess_to/)
58. Active Recall: The \#1 Study Technique Backed by Science | LearnLog, [https://learnlog.app/learn/active-recall/](https://learnlog.app/learn/active-recall/)
59. Different Perspectives on Retest Effects in the Context of Spatial Thinking: Interplay of Behavioral Performance, Cognitive Processing, and Cognitive Workload \- PMC, [https://pmc.ncbi.nlm.nih.gov/articles/PMC10145210/](https://pmc.ncbi.nlm.nih.gov/articles/PMC10145210/)
60. Effectiveness of Spaced Repetition for Learning Chess Strategies \- Chessable, [https://www.chessable.com/discussion/thread/905482/effectiveness-of-spaced-repetition-for-learning-chess-strategies/905873/](https://www.chessable.com/discussion/thread/905482/effectiveness-of-spaced-repetition-for-learning-chess-strategies/905873/)
61. Retrieval Practice Consistently Benefits Student Learning: a Systematic Review of Applied Research in Schools and Classrooms, [https://pdf.poojaagarwal.com/Agarwal_etal_2021_EDPR.pdf](https://pdf.poojaagarwal.com/Agarwal_etal_2021_EDPR.pdf)
62. Full article: Do differences in topic knowledge matter? An experimental investigation into topic knowledge as a possible moderator of the testing effect \- Taylor & Francis, [https://www.tandfonline.com/doi/full/10.1080/09658211.2025.2500538](https://www.tandfonline.com/doi/full/10.1080/09658211.2025.2500538)
63. Deliberate Practice and Performance in Music, Games, Sports, Education, and Professions: A Meta-Analysis \- ResearchGate, [https://www.researchgate.net/publication/263713247_Deliberate_Practice_and_Performance_in_Music_Games_Sports_Education_and_Professions_A_Meta-Analysis](https://www.researchgate.net/publication/263713247_Deliberate_Practice_and_Performance_in_Music_Games_Sports_Education_and_Professions_A_Meta-Analysis)
64. Use the Woodpecker Method to Improve Drastically \- House of Staunton, [https://www.houseofstaunton.com/blogs/chess-tutorials/the-woodpecker-method](https://www.houseofstaunton.com/blogs/chess-tutorials/the-woodpecker-method)
65. The Woodpecker Method: How to get the best of both worlds \- ChessBase, [https://en.chessbase.com/post/the-woodpecker-method-how-to-get-the-best-of-both-worlds](https://en.chessbase.com/post/the-woodpecker-method-how-to-get-the-best-of-both-worlds)
66. The role of domain-specific practice, handedness, and starting age in chess., [https://www.semanticscholar.org/paper/The-role-of-domain-specific-practice%2C-handedness%2C-Gobet-Campitelli/fe0fc5dfc4e72a4622c6b8d869a9903b605eb2e7](https://www.semanticscholar.org/paper/The-role-of-domain-specific-practice%2C-handedness%2C-Gobet-Campitelli/fe0fc5dfc4e72a4622c6b8d869a9903b605eb2e7)
67. Chess Memory Training: Free Techniques & Drills (2026), [https://darksquares.net/learn/chess-memory-training](https://darksquares.net/learn/chess-memory-training)
68. Checkmate to deliberate practice: the case of Magnus Carlsen \- PMC, [https://pmc.ncbi.nlm.nih.gov/articles/PMC4132259/](https://pmc.ncbi.nlm.nih.gov/articles/PMC4132259/)
69. (PDF) Deliberate Practice: Necessary But Not Sufficient \- ResearchGate, [https://www.researchgate.net/publication/226396370_Deliberate_Practice_Necessary_But_Not_Sufficient](https://www.researchgate.net/publication/226396370_Deliberate_Practice_Necessary_But_Not_Sufficient)
70. Talent and Practice 1 Gobet. F. & Campitelli, G. (2007). The role of domain-specific practice, handedness and starting age i \- Brunel University Research Archive, [https://bura.brunel.ac.uk/bitstream/2438/611/1/Gobet_DevPsyc_Final.pdf](https://bura.brunel.ac.uk/bitstream/2438/611/1/Gobet_DevPsyc_Final.pdf)
71. How are habits formed: Modeling habit formation in the real world \- ResearchGate, [https://www.researchgate.net/publication/32898894_How_are_habits_formed_Modeling_habit_formation_in_the_real_world](https://www.researchgate.net/publication/32898894_How_are_habits_formed_Modeling_habit_formation_in_the_real_world)
72. Deliberate practice and performance in music, games, sports, education, and professions: a meta-analysis \- PubMed, [https://pubmed.ncbi.nlm.nih.gov/24986855/](https://pubmed.ncbi.nlm.nih.gov/24986855/)

[image1]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAAAaCAYAAAD/nKG4AAACgklEQVR4Xu2Xy6uNURjGH5dIiOR+GcklDBiI3I0oAx2XcvsDDNwGKCYkIrlP3JKYSIQhIwzEyMwtdFyLRDKQdMLz7Pf72mu/5zvrbJtzdpv1q1/t/bzf3rv17vWttT4gkUgkEolOZhN9QB/Rp/RQZTnKUHqUPqOv6b3KcgUD6FgfNhof6JTs9SB6l/Yql6O8pafpwOz9KdqnXC7RhW6gb+gBV2soZsIGEjKZbnNZEWrsteD9SPoT9vmcFfQbfZLVGrpZr+hoH8IGNsyHAb3pV9rNF9pgM/6gWf3pPthaofv9DG1G9T/+N+hJf9DhvgAb2GwfBiyGXaOZeZs+hs2e9eFFATU3azx9SW/AFr2u9DzsX+5MBsMGoEXao7zJhwEbYddcp/2ybCGs+UXU3Kzn9B3tG2ST6IXgfRHL6IvfcBXijEK8WSt9GLAHds1Ul9+k01wmam6WPrTbZUvpWpd1NEMQb9YSHwZsh13jOUFP+hDlZh30hRgT6GfYdhqitaseNNNxPoQNbIQPA+ahuFk6c2l2efJmHfaFGDPoLZfla0d7LIedVap1jX0syjk612Va+HU4jdGdfvQh7MxVNHvyZh3xhRia8lddthXVNasjmAX7/RDtgj5bRCe67Dgd47L7KJ6pebOO+UJ76F/XDqJjwjragvo1S3yi07PXOltpwD3K5RJf6GWXac3TsUFHD534t6Dt3XA/bIwX0fq7o1yi72HPYrtgO5caWC/0bPgQtkvrzLe3slxCjzGrfUjOwh6XdEC9QxdUljEfdoJXo3LVUGVRNJv8/bwD9gVzXP7fE65NugX1TPad7swvSJTRM5hOvHos0C14Ba13okQikUgk/l1+AU2kmU1FwaKfAAAAAElFTkSuQmCC
[image2]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAXCAYAAAA7kX6CAAAA9klEQVR4Xu2Suw4BURRFDxpEQTQakYhWokKlJpFotQq9QvRKhZoP8A++QRQ0IlERlQiNinjtM2ced040+lnJSmb2uXsed4Yo4C9e8A0/tnzM2QNOYd5b6icGDySlBozCBMzAHbzBmrvaIE1SusCImvXs2ULlFi2S4UwPwIRkdtIDZgmfMGVk/PhNktIaJo2ZC5fucG97Jm+zRjDuLNTwgrFxHoZ9eDWyn3CxrbIQSVFvlg8uFnRIUizq0KEO5zoEHZIL8qf6Cb/8UIdgQFJ0HpV/DAv+M7JwQ3J1PudNcaiSd8cc3HJYskNtRTouXXiEK1hWswCTL5WiOAnPMPXXAAAAAElFTkSuQmCC
[image3]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAbCAYAAABMU775AAAA6ElEQVR4Xu3RsUpCYRyG8b8uCUq0BQYSDiVegbgKRnQF4i20OYsQtHUFXUKD4ODgJDgkRKuDU0OD4JTRIJbY8/Gdg5+vegfngd/ynu+coxyzJC2lg1ZBDwt8Y4w6BuEhrY0v3OMMGdzhE8/Bub3WqOpITTR0jHP/YaRjVAHnOsYVMdQx6kIHbRP5wzuecL1z4kgvWNn2Ac4StfDQsbK4wSNm5m9+2zkRlMeJjlQ2f6P7RAd7xZWOUT+Y6OjK4ReXsrtK5t/Y0QuuW/MXW7Kn0ceH+Yfv1TX/Dd1PnZt/+xQPOA3OJSX5/gETiCllE9uQHAAAAABJRU5ErkJggg==
[image4]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAAaCAYAAAC6nQw6AAAA60lEQVR4Xu2SvQ4BURCFTyhRqCUSLSIREU/hEdQSlSiISidR8Aw6CQ2NF/AInkKCaP0E52Z2s9dwbSWa/ZKv2D0zczO7F4j4GzN6pw+HJ7qiFb/BRZwm6QbSOPCejVnapAd6pnWvx0kMcrIZVFKZoUivkIFfaUOGLHRgMYTUfGUJKWrpwGKCkEFmrSOkKK8ymzVCBpUhBTsdWJjD9ggZ1IEUzHVgUUNwHZz4f8u1Vhqy+o1WVfZC2FpTSE1PvX/DtZa5qGNIPlLZCwmagRT2EdzmFM3RLWSlht/wiQK9IPiAWpN1Id8nIuKnPAHstj7al40jWwAAAABJRU5ErkJggg==
