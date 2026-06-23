// The Methodology layer's public surface (BUILD.md §2.3). The Engine (engine/, server/,
// app/, analysis/) imports the loader, the provider pure functions, and the types from
// here — never the schema internals or config JSON directly. This is the typed boundary
// across which science enters the system (VISION §4).

export {
  loadMethodology,
  ACTIVE_METHODOLOGY_VERSION,
} from "@/methodology/loader";

export {
  nextCalibrationItem,
  scoreCalibration,
  buildImplementationIntention,
  // Seam 9 (engagement, M9): the reward-event policy reader the engine event bus calls.
  engagementEventsFor,
  // Program-engine seams (M6): Seams 1/3/4/5/7/8 pure reader functions.
  bandForRating,
  interpretGameFeatures,
  confidenceFromSampleSize,
  mapWeaknessToActivities,
  interfaceAffordancesFor,
  targetPuzzleRating,
  practiceStructure,
  useWorkedExample,
  prioritizeDailyMix,
  rationaleFor,
  // Seam 6 (scheduling) + Measurement seams (M7): the adaptation-loop reader functions.
  gradeFromOutcome,
  scheduleReview,
  detectPlateau,
  isProgressReal,
  isStableBaseline,
  // Measurement seam (M8): per-band expectation copy for the transparency dashboard.
  expectationForBand,
  // Seam 4 §4.1: structured game analysis protocol functions
  gameAnalysisProtocol,
  filterEngineLines,
  selectGamesForAnalysis,
  detectTilt,
  gameSelectionRatioFor,
  type GradedExpectation,
  type EngagementStateChange,
  type EngagementEvent,
  type RewardEventType,
  type CalibrationResponse,
  type NextCalibrationItem,
  type CalibrationEstimate,
  type IfThenPlan,
  type Band,
  type Track,
  type Confidence,
  type PracticeStructureKind,
  type WeaknessSignal,
  type CandidateActivity,
  type BoardAffordances,
  type TargetFocus,
  type ScoredCandidate,
  type MixPreferences,
  type DueItem,
  type PuzzleTarget,
  type FsrsGrade,
  type FsrsState,
  type RatingPoint,
  type PlateauResult,
  // Seam 4 §4.1: structured game analysis protocol types
  type CriticalMoment,
  type FilteredLine,
  type SRSPuzzle,
  type SuggestedGame,
  type TiltState,
  type EngineLine,
  type RecentGame,
  type RecentResult,
} from "@/methodology/provider";

export type {
  MethodologyConfig,
  AssessmentConfig,
  CalibrationConfig,
  CalibrationTrack,
  BandDefinition,
  SkillDimension,
  InterpretationConfig,
  ActivityDefinition,
  WeaknessResourceRule,
  DifficultyConfig,
  SchedulingConfig,
  PrioritizationConfig,
  EngagementConfig,
  EngagementEventRule,
  MeasurementConfig,
  RationaleEntry,
  AnchorSource,
  GameAnalysisConfig,
  EmotionalCalibrationConfig,
  ActiveReproductionConfig,
  RplFilteringConfig,
  SrsIntegrationConfig,
  GameSelectionConfig,
  TiltTriggerConfig,
} from "@/methodology/schema/config";

export type {
  Grade,
  Tier,
  GradedFlag,
  GradedValue,
} from "@/methodology/schema/graded";
