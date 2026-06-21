// TransparencyCard — the honesty-brand component (BUILD.md §7.6). Renders the "why this /
// why now" rationale snapshotted on a ProgramItem (L3) together with its evidence grade,
// tier, confidence and citation. A softened (C/D) or low-confidence value is visibly
// flagged so a placeholder can never read as established fact (VISION §2). This is the
// framework now; M8 expands the dashboards around it.

const GRADE_NOTE: Record<string, string> = {
  A: "Strong, replicated evidence",
  B: "Suggestive but limited",
  C: "Theory / best-guess",
  D: "Popular but unsupported — avoid",
};

const TIER_NOTE: Record<number, string> = {
  1: "chess-specific",
  2: "general learning science",
};

const CONFIDENCE_NOTE: Record<string, string> = {
  insufficient: "not enough of your data yet",
  low: "band prior, not your own data yet",
  medium: "some of your own data",
  high: "well-backed by your own data",
};

export interface TransparencyCardProps {
  rationaleText: string;
  evidenceGrade: string;
  evidenceTier: number;
  citationKey: string;
  citationSource?: string | null;
  confidence: string;
  soften: boolean;
}

export function TransparencyCard({
  rationaleText,
  evidenceGrade,
  evidenceTier,
  citationKey,
  citationSource,
  confidence,
  soften,
}: TransparencyCardProps) {
  return (
    <div
      className="text-muted-foreground rounded-md border border-dashed p-3 text-sm"
      role="note"
    >
      <p className="text-xs font-medium uppercase tracking-wide">Why this?</p>
      <p className="text-foreground mt-1">{rationaleText}</p>

      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <div className="flex items-center gap-1">
          <dt className="font-medium">
            Grade {evidenceGrade} · Tier {evidenceTier}
          </dt>
          <dd>
            ({GRADE_NOTE[evidenceGrade] ?? "—"};{" "}
            {TIER_NOTE[evidenceTier] ?? "—"})
          </dd>
        </div>
        <div className="flex items-center gap-1">
          <dt className="font-medium">Confidence:</dt>
          <dd>
            {confidence} ({CONFIDENCE_NOTE[confidence] ?? "—"})
          </dd>
        </div>
      </dl>

      {soften && (
        <p className="mt-2 italic">
          Honest caveat: the evidence here is thin, so treat this as a
          best-guess starting point, not a proven prescription. No training
          activity is proven to cause a rating gain.
        </p>
      )}

      <p className="mt-2 text-xs opacity-70">
        Source: {citationSource ?? citationKey}
      </p>
    </div>
  );
}
