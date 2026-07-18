/**
 * Deliberate coverage classification for every model that directly belongs to a User.
 * The privacy schema guard compares these keys with Prisma's generated data model, so a
 * new user relation cannot land without an explicit export decision.
 */
export const USER_DATA_EXPORT_COVERAGE = {
  Account: { exportPath: "accounts", treatment: "credential_redacted" },
  ActivityEvent: { exportPath: "activityEvents", treatment: "included" },
  AdaptationLog: { exportPath: "adaptationLogs", treatment: "included" },
  AllowlistEntry: {
    exportPath: "claimedAllowlistEntries",
    treatment: "credential_redacted",
  },
  ApiCallBudget: { exportPath: "apiCallBudgets", treatment: "included" },
  Assessment: { exportPath: "assessment", treatment: "included" },
  AvailabilityOverride: {
    exportPath: "availabilityOverrides",
    treatment: "included",
  },
  ChessProfileSnapshot: {
    exportPath: "chessProfileSnapshots",
    treatment: "included",
  },
  ConstraintSet: { exportPath: "constraintSets", treatment: "included" },
  ImportedGame: {
    exportPath: "importedGames",
    treatment: "included_with_analysis",
  },
  NotificationPref: { exportPath: "notificationPref", treatment: "included" },
  PlatformConnection: {
    exportPath: "platformConnections",
    treatment: "credential_redacted",
  },
  PracticeItem: { exportPath: "practiceItems", treatment: "included" },
  ProductFeedback: { exportPath: "productFeedback", treatment: "included" },
  Program: {
    exportPath: "programs",
    treatment: "included_with_program_items",
  },
  ProgramDayForecast: {
    exportPath: "programDayForecasts",
    treatment: "included",
  },
  ProgramRevision: { exportPath: "programRevisions", treatment: "included" },
  RecommendationExposure: {
    exportPath: "recommendationExposures",
    treatment: "included",
  },
  ResearchConsent: { exportPath: "researchConsents", treatment: "included" },
  RewardEvent: { exportPath: "rewardEvents", treatment: "included" },
  ScheduleState: { exportPath: "scheduleStates", treatment: "included" },
  Session: { exportPath: "sessions", treatment: "credential_redacted" },
  SkillState: { exportPath: "skillStates", treatment: "included" },
  SkillStateSnapshot: {
    exportPath: "skillStateSnapshots",
    treatment: "included",
  },
  TrainingFeedback: { exportPath: "trainingFeedback", treatment: "included" },
  TrainingFeedbackPrompt: {
    exportPath: "trainingFeedbackPrompts",
    treatment: "included",
  },
  TrainingPreferenceState: {
    exportPath: "trainingPreferenceState",
    treatment: "included",
  },
  WeeklyAvailability: {
    exportPath: "weeklyAvailability",
    treatment: "included",
  },
  WeeklyFocus: { exportPath: "weeklyFocuses", treatment: "included" },
} as const;

export type UserDataExportModel = keyof typeof USER_DATA_EXPORT_COVERAGE;

/** User-owned cascade descendants embedded under their exported parent rows. */
export const INDIRECT_USER_DATA_EXPORT_COVERAGE = {
  AnalysisResult: {
    parentModel: "ImportedGame",
    exportPath: "importedGames[].analysis",
  },
  ProgramItem: {
    parentModel: "Program",
    exportPath: "programs[].items",
  },
} as const;
