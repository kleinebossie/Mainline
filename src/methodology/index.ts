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
  // Program-engine seams (M6): Seams 1/3/4/5/7/8 pure reader functions.
  bandForRating,
  interpretGameFeatures,
  confidenceFromSampleSize,
  mapWeaknessToActivities,
  targetPuzzleRating,
  practiceStructure,
  useWorkedExample,
  prioritizeDailyMix,
  rationaleFor,
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
  type ScoredCandidate,
  type DueItem,
  type PuzzleTarget,
} from "@/methodology/provider";

export type {
  MethodologyConfig,
  AssessmentConfig,
  CalibrationConfig,
  BandDefinition,
  SkillDimension,
  InterpretationConfig,
  ActivityDefinition,
  WeaknessResourceRule,
  DifficultyConfig,
  PrioritizationConfig,
  RationaleEntry,
  AnchorSource,
} from "@/methodology/schema/config";

export type {
  Grade,
  Tier,
  GradedFlag,
  GradedValue,
} from "@/methodology/schema/graded";
