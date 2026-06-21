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
  type CalibrationResponse,
  type NextCalibrationItem,
  type CalibrationEstimate,
  type IfThenPlan,
} from "@/methodology/provider";

export type {
  MethodologyConfig,
  AssessmentConfig,
  CalibrationConfig,
  BandDefinition,
  AnchorSource,
} from "@/methodology/schema/config";

export type {
  Grade,
  Tier,
  GradedFlag,
  GradedValue,
} from "@/methodology/schema/graded";
