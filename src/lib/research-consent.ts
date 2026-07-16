export const CURRENT_DATA_USE_NOTICE = {
  id: "research-data-use/2026-07-16",
  title: "Optional aggregate observational research",
  summary:
    "With your separate consent, Mainline may include de-identified recommendation, training-outcome, constraint, and rating records in controlled observational analyses of associations. This cannot prove that an activity causes rating gain, and individual histories are never published.",
  withdrawal:
    "Withdrawal stops future optional secondary inclusion. It does not remove operational storage needed for personal training. Use account deletion to erase your account data.",
} as const;

export type ResearchConsentScope = "aggregate_observational_training";

export interface DataUseNoticeVersion {
  id: string;
  title: string;
  summary?: string;
  withdrawal?: string;
}

export interface ResearchConsent {
  id: string;
  userId: string;
  noticeVersion: string;
  scopes: string[];
  grantedAt: Date;
  withdrawnAt: Date | null;
}

/** Fail closed. P9 may use this predicate before any secondary-use capture. */
export function hasCurrentResearchConsent(
  consent: ResearchConsent | null | undefined,
  scope: ResearchConsentScope,
  notice: DataUseNoticeVersion = CURRENT_DATA_USE_NOTICE,
): boolean {
  return Boolean(
    consent &&
    consent.withdrawnAt === null &&
    consent.noticeVersion === notice.id &&
    consent.scopes.includes(scope),
  );
}
