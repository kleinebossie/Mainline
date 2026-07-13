import { GradeMark } from "@/components/evidence";
import { cn } from "@/lib/utils";

const MIN_RATING = 800;
const MAX_RATING = 2500;

function ratingPercent(rating: number): number {
  return Math.min(
    100,
    Math.max(0, ((rating - MIN_RATING) / (MAX_RATING - MIN_RATING)) * 100),
  );
}

type CalibrationTrack = {
  id: string;
  label: string;
  estimate: {
    tacticalRatingEstimate: number;
    uncertainty: number;
    evidenceGrade: string;
  };
};

export function CalibrationTrackGauges({
  tracks,
  className,
}: {
  tracks: readonly CalibrationTrack[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {tracks.map((track) => {
        const rating = track.estimate.tacticalRatingEstimate;
        const uncertainty = track.estimate.uncertainty;
        const left = ratingPercent(rating - uncertainty);
        const width = ratingPercent(rating + uncertainty) - left;

        return (
          <div
            key={track.id}
            className="flex flex-col gap-2 rounded-md border bg-paper/30 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-serif text-base font-semibold text-ink">
                {track.label}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold tabular-nums text-ink">
                  ≈ {rating} ± {uncertainty}
                </span>
                <GradeMark grade={track.estimate.evidenceGrade} />
              </span>
            </div>
            <div className="relative h-3 w-full overflow-hidden rounded-sm border border-line bg-ink/5 dark:bg-ink/20">
              <div
                className="absolute top-0 bottom-0 border-x border-evergreen/30 bg-evergreen/15 dark:bg-evergreen/35"
                style={{ left: `${left}%`, width: `${width}%` }}
              />
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-evergreen"
                style={{ left: `${ratingPercent(rating)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
