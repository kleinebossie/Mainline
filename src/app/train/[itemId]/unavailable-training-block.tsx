import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorNotice } from "@/components/ui/error-notice";

interface UnavailableTrainingBlockProps {
  error: unknown;
  pending: boolean;
  onClose: () => void;
  onRetry: () => void;
}

export function UnavailableTrainingBlock({
  error,
  pending,
  onClose,
  onRetry,
}: UnavailableTrainingBlockProps) {
  return (
    <div className="settle mx-auto flex w-full max-w-2xl flex-col gap-5 py-6">
      {error != null && (
        <ErrorNotice
          error={error}
          heading="Block not closed"
          message="The block is still waiting in Today. Try closing it again."
          onRetry={onRetry}
          retrying={pending}
          retryLabel="Try closing again"
        />
      )}

      <Card className="overflow-hidden border-dashed">
        <div className="grid sm:grid-cols-[5.5rem_minmax(0,1fr)]">
          <div className="flex min-h-20 items-center justify-center bg-ink text-paper sm:min-h-64">
            <span
              aria-hidden
              className="font-mono text-4xl font-light tracking-tighter text-paper/80"
            >
              ∅
            </span>
          </div>
          <div className="flex flex-col justify-center p-6 sm:p-8">
            <p className="eyebrow">Position set empty</p>
            <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight text-ink">
              This block has no positions left to train.
            </h1>
            <p className="mt-4 max-w-lg font-serif text-sm leading-relaxed text-graphite">
              Its assigned positions are no longer due or available. Close the
              block as skipped so it leaves Today without counting as completed
              training.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button type="button" onClick={onClose} disabled={pending}>
                {pending ? "Closing block…" : "Skip unavailable block"}
              </Button>
              <Link
                href="/today"
                className={buttonVariants({ variant: "ghost" })}
              >
                Back without changing
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
