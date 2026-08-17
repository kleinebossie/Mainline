"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useEffect } from "react";

import { trpc } from "@/lib/trpc/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GradeMark, type EvidenceGrade } from "@/components/evidence";
import { TransparencyCardGroup } from "@/components/transparency-card";
import { StatusMessage } from "@/components/ui/status-message";
import { ErrorNotice } from "@/components/ui/error-notice";
import { CalibrationTrackGauges } from "@/app/onboarding/calibration-track-gauges";
import { InstantBlunderDrill } from "@/app/onboarding/instant-blunder-drill";

export function FirstSessionAction({
  error,
  pending,
  onBuild,
}: {
  error: unknown | null;
  pending: boolean;
  onBuild: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line/80 pt-5">
      {error != null && (
        <ErrorNotice
          error={error}
          heading="First session not built"
          message="Your setup is saved. Try building the session again."
          className="w-full"
        />
      )}
      <Button
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={onBuild}
      >
        {pending
          ? "Building your session..."
          : error
            ? "Try building again"
            : "Build my first session →"}
      </Button>
    </div>
  );
}

// The reveal: the honest "what your games say vs. what you assumed" moment (VISION §2;
// the Dunning–Kruger guard, Seam 2). It contrasts the BEHAVIOURAL baseline (calibration +
// game-derived weakness signals) against the user's STATED goals — and where the data is
// thin it says so plainly rather than inventing a verdict (L3).
import { getGuestSession, generateGuestProgram } from "@/lib/guest-session";

export function Reveal() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const guestSession = typeof window !== "undefined" ? getGuestSession() : null;
  const isGuest =
    guestSession?.baseline != null || guestSession?.constraints != null;

  const state = trpc.assessment.state.useQuery(undefined, {
    enabled: !isGuest,
    retry: false,
  });
  const signals = trpc.program.gameSignals.useQuery(undefined, {
    enabled: !isGuest,
    retry: false,
  });
  const constraints = trpc.constraints.getCurrent.useQuery(undefined, {
    enabled: !isGuest,
    retry: false,
  });
  const library = trpc.analysis.library.useQuery(undefined, {
    enabled: !isGuest,
    retry: false,
  });
  const generate = trpc.program.generate.useMutation({
    onSuccess: (data) => {
      if (data) {
        utils.program.getToday.setData(undefined, data);
      }
      void utils.program.getToday.invalidate();
      router.push("/today");
    },
  });

  useEffect(() => {
    if ((isGuest || state.data?.completed) && typeof window !== "undefined") {
      localStorage.setItem("mainline_reveal_seen", "true");
    }
  }, [isGuest, state.data?.completed]);

  if (!isGuest && state.isLoading) {
    return (
      <StatusMessage tone="loading">
        Loading your starting picture…
      </StatusMessage>
    );
  }

  if (!isGuest && (state.error || !state.data)) {
    return (
      <ErrorNotice
        error={state.error}
        heading="Starting picture unavailable"
        message="Mainline could not load your calibration result. Try this step again."
        onRetry={() => void state.refetch()}
        retrying={state.isFetching}
        retryLabel="Reload starting picture"
      />
    );
  }

  const isGuestCalibrated = Boolean(
    guestSession?.baseline?.calibratedAt ||
    (guestSession?.calibrationResponses &&
      guestSession.calibrationResponses.length >= 3),
  );
  const guestRating = guestSession?.baseline?.tacticalRatingEstimate ?? 1450;
  const guestUncertainty = guestSession?.baseline?.uncertainty ?? 350;
  const completed = isGuest
    ? isGuestCalibrated
    : Boolean(state.data?.completed);
  const estimate = isGuest
    ? isGuestCalibrated
      ? {
          tacticalRatingEstimate: guestRating,
          uncertainty: guestUncertainty,
          evidenceGrade: "A",
          evidenceTier: 1,
          citationKey: "de_groot_1965",
          confidence: "high",
          soften: false,
          flag: null,
        }
      : null
    : state.data?.estimate;
  const tracks = isGuest
    ? [
        {
          id: "tactics",
          dimension: "tactics",
          label: "Tactical pattern recognition",
          theme: guestSession?.baseline?.topBlindspot || "mix",
          completed: true,
          responseCount: guestSession?.calibrationResponses?.length ?? 3,
          next: {
            itemNumber: 3,
            totalItems: 3,
            ratingTarget: guestRating,
            done: true,
          },
          estimate: {
            tacticalRatingEstimate: guestRating,
            uncertainty: guestUncertainty,
            evidenceGrade: "A",
          },
        },
      ]
    : (state.data?.tracks ?? []);

  if (!completed || !estimate) {
    return (
      <Card className="settle border-line bg-card shadow-sheet p-6 sm:p-8">
        <div className="flex flex-col gap-5">
          <div>
            <p className="eyebrow text-evergreen">Step 4 of setup</p>
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold mt-1">
              Tactical calibration not completed yet
            </h2>
            <p className="text-graphite text-sm sm:text-base font-serif leading-relaxed mt-2 max-w-xl">
              Mainline uses a short 3-puzzle adaptive check to measure pattern
              recognition and blunder sensitivity. Complete calibration to
              reveal your starting tactical baseline and blindspots.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/onboarding/calibration"
              className={buttonVariants({ size: "default" })}
            >
              Start 3-puzzle calibration →
            </Link>
            <Link
              href="/today"
              className={buttonVariants({
                variant: "outline",
                size: "default",
              })}
            >
              Skip to Today&apos;s training →
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  const goals = isGuest
    ? (guestSession?.constraints?.goals.map((g) => ({ kind: g, label: g })) ??
      [])
    : (constraints.data?.goals ?? []);
  const supportingError = isGuest
    ? null
    : (signals.error ?? constraints.error ?? library.error ?? null);

  return (
    <div className="flex flex-col gap-6">
      {supportingError && (
        <ErrorNotice
          error={supportingError}
          heading="Some supporting data is unavailable"
          message="Your calibration result is ready, but Mainline could not load game signals, goals, or review options. Reload them for the complete picture."
          onRetry={() => {
            void signals.refetch();
            void constraints.refetch();
            void library.refetch();
          }}
          retrying={
            signals.isFetching || constraints.isFetching || library.isFetching
          }
          retryLabel="Reload supporting data"
        />
      )}
      {/* 1 — the measured, multi-dimensional baseline */}
      <Card gutter={estimate.evidenceGrade as EvidenceGrade} className="settle">
        <CardHeader className="pb-4">
          <CardTitle className="font-serif text-2xl font-semibold">
            Your starting baseline
          </CardTitle>
          <p className="text-graphite font-mono text-sm mt-1">
            {tracks.length === 1
              ? "A behavioural read of your tactical level."
              : `A behavioural read across ${tracks.length} dimensions.`}{" "}
            Uncertainty shrinks with more games and reviews.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <CalibrationTrackGauges tracks={tracks} />

          <div className="bg-paper/60 rounded-md border border-dashed p-4">
            <div className="flex items-center gap-2 mb-3">
              <GradeMark grade={estimate.evidenceGrade} />
              {estimate.flag && (
                <span className="border-clay/40 bg-clay/10 text-clay rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider">
                  {estimate.flag}
                </span>
              )}
            </div>
            <p className="text-ink font-serif text-[0.95rem] leading-relaxed">
              These are rough calibration points, not verdicts. The fuller
              picture, your real leaks, comes from your games, below.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 2 — what the games actually reveal (Seam 3), honestly gated */}
      <Card className="settle [animation-delay:80ms]">
        <CardHeader className="pb-4">
          <CardTitle className="font-serif text-2xl font-semibold">
            What your games reveal
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {signals.isLoading ? (
            <p className="text-graphite font-mono text-sm">
              Reading your games…
            </p>
          ) : !signals.data || signals.data.gamesAnalysed === 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-graphite text-sm leading-relaxed font-serif">
                No analysed games yet, so we won&apos;t guess at your
                weaknesses. Run the in-browser analysis and your real leaks
                (blunders, phase slips, time use) appear here.
              </p>
              <Link
                href="/settings#data"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Analyse my games →
              </Link>
            </div>
          ) : signals.data.signals.length === 0 ? (
            <p className="text-graphite text-sm leading-relaxed font-serif">
              Across {signals.data.gamesAnalysed} analysed game
              {signals.data.gamesAnalysed === 1 ? "" : "s"}, nothing yet rises
              clearly above the noise. We won&apos;t invent a weakness. As more
              games are analysed, real signals will surface.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-graphite text-sm leading-relaxed font-serif">
                From {signals.data.gamesAnalysed} analysed game
                {signals.data.gamesAnalysed === 1 ? "" : "s"}:
              </p>
              <TransparencyCardGroup
                items={signals.data.signals.map((signal) => ({
                  title: signal.dimensionLabel,
                  rationaleText: signal.rationaleText,
                  evidenceGrade: signal.evidenceGrade,
                  evidenceTier: signal.evidenceTier,
                  citationKey: signal.citationKey,
                  citationSource: signal.citationSource,
                  confidence: signal.confidence,
                  soften: signal.soften,
                }))}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2.5: see it for yourself: the interactive first blunder drill (M12) */}
      {!isGuest && (
        <InstantBlunderDrill
          onContinue={() => {
            if (!generate.isPending) {
              generate.mutate();
            }
          }}
        />
      )}

      {/* 3 — what you said you want, and how we reconcile it */}
      <Card className="settle [animation-delay:160ms]">
        <CardHeader className="pb-4">
          <CardTitle className="font-serif text-2xl font-semibold">
            What you told us you want
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {goals.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {goals.map((g, i) => (
                <li
                  key={`${g.kind}-${i}`}
                  className="border-line bg-paper/40 text-ink rounded-full border px-3 py-1 font-mono text-xs"
                >
                  {g.label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-graphite text-sm leading-relaxed font-serif">
              You haven&apos;t set goals yet: you can add them any time in
              Settings.
            </p>
          )}
          <p className="text-graphite text-sm leading-relaxed font-serif border-t border-line/80 pt-4">
            You stay in control. Where your games and your goals point the same
            way, we lean in hard. Where they disagree, we trust your{" "}
            <span className="text-ink font-medium">games</span> for the
            diagnosis and your{" "}
            <span className="text-ink font-medium">goals</span> for what to
            emphasise, and we always show the evidence.
          </p>
          <FirstSessionAction
            error={generate.error}
            pending={generate.isPending}
            onBuild={() => {
              if (isGuest) {
                generateGuestProgram();
                router.push("/today");
                return;
              }
              generate.mutate();
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
