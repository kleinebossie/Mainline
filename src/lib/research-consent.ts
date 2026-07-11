export const CURRENT_DATA_USE_NOTICE = {
  id: "research-data-use/2026-07-11",
  title: "Optional aggregate observational research",
  summary:
    "A future feature may use consented training and game records in de-identified aggregate analyses to study associations. It will not prove that an activity causes rating gain. Secondary research capture is currently disabled.",
  withdrawal:
    "Withdrawal stops future optional secondary inclusion. It does not remove operational storage needed for personal training. Use account deletion to erase your account data.",
} as const;

export const RESEARCH_CONSENT_SCOPES = [
  "aggregate_observational_training",
] as const;

export type ResearchConsentScope = (typeof RESEARCH_CONSENT_SCOPES)[number];

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
