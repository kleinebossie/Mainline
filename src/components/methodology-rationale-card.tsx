import { TransparencyCard } from "@/components/transparency-card";
import type { RationaleEntry } from "@/methodology";

export function MethodologyRationaleCard({
  rationale,
  confidence = "medium",
}: {
  rationale: RationaleEntry;
  confidence?: string;
}) {
  return (
    <TransparencyCard
      rationaleText={rationale.value}
      evidenceGrade={rationale.grade}
      evidenceTier={rationale.tier}
      citationKey={rationale.citationKey}
      confidence={confidence}
      soften={rationale.soften}
      flag={rationale.flag}
    />
  );
}
