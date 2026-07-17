import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { OnboardingSteps } from "@/app/onboarding/onboarding-steps";
import { FirstSessionAction } from "@/app/onboarding/reveal/reveal";
import { ProgramArchive } from "@/app/today/program-history";
import { TodayBlockList, TodayHeader } from "@/app/today/today-session";
import { UnexpectedError } from "@/components/unexpected-error";
import { ErrorNotice } from "@/components/ui/error-notice";
import type { ProgramHistoryEntry } from "@/lib/program-history";
import type { OnboardingStatus } from "@/server/onboarding";
import type { TodayItem, TodayProgram } from "@/server/program";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const noOp = () => undefined;
const evidence = {
  evidenceGrade: "B" as const,
  evidenceTier: 1 as const,
  citationKey: "qa.fixture",
  citationSource: "QA fixture",
  confidence: "medium",
  soften: false,
};

function item(id: string, status: string): TodayItem {
  return {
    id,
    orderIndex: Number(id),
    label:
      id === "1"
        ? "Calculation under pressure"
        : id === "2"
          ? "Review yesterday's critical position"
          : "Play one focused rapid game",
    activityType: id === "3" ? "play_game" : "study",
    dimensionLabels: ["calculation"],
    estMinutes: id === "3" ? 15 : 10,
    params: {
      theme: null,
      track: null,
      ...(id === "1"
        ? {
            fitExplanation: {
              text: "Positive fit feedback broke an equal methodology tie.",
              evidenceGrade: "C" as const,
              evidenceTier: 2 as const,
              citationKey: "qa.fit",
              flag: "best-guess" as const,
              soften: true,
            },
          }
        : {}),
    },
    reviewThemes: [],
    externalUrl: null,
    externalLabel: null,
    url: null,
    delivery: "external",
    bookResource: null,
    rationaleText: "This block targets the current weekly focus.",
    ...evidence,
    status,
  };
}

function program(statuses: string[]): TodayProgram {
  return {
    id: "program-qa",
    createdAt: new Date("2026-07-14T08:00:00.000Z"),
    scheduledDate: new Date("2026-07-14T00:00:00.000Z"),
    methodologyVersion: "qa",
    honesty: {
      expectations: "Consistency matters more than a perfect single session.",
      processGoal: "Calculate forcing moves before choosing a line.",
      expectationsEvidence: evidence,
      processGoalEvidence: evidence,
    },
    items: statuses.map((status, index) => item(String(index + 1), status)),
  };
}

function todayMarkup(statuses: string[]) {
  const current = program(statuses);
  return renderToStaticMarkup(
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header>
        <p className="eyebrow">Your training</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-ink">
          Today
        </h1>
      </header>
      <div id="today" className="flex flex-col gap-4">
        <TodayHeader
          program={current}
          due={0}
          actualMinutes={10}
          actualMeasuredEvents={1}
          actualEventCount={1}
          actualMeasurementTruncated={false}
          historyLoading={false}
          historyError={false}
          timeInput="35"
          setTimeInput={noOp}
          timeBusy={false}
          timeValid
          timeChanged={false}
          onRegenerate={noOp}
        />
        <TodayBlockList
          items={current.items}
          ownedBooks={[]}
          libraryLoading={false}
          onLogOutcome={noOp}
          onBookLogged={noOp}
          onUndoSkip={noOp}
        />
      </div>
      <div id="history">
        <ProgramArchive
          entries={[]}
          currentProgramId={current.id}
          loading={false}
          error={false}
          hasMore={false}
          loadingMore={false}
          onRetry={noOp}
          onLoadMore={noOp}
        />
      </div>
    </main>,
  );
}

function historyEntry(
  id: string,
  scheduledDate: string,
  createdAt: string,
  current = false,
): ProgramHistoryEntry {
  const date = new Date(scheduledDate);
  return {
    id,
    status: current ? "active" : "superseded",
    scheduledDate: date,
    createdAt: new Date(createdAt),
    methodologyVersion: "research-1.3.0",
    plannedMinutes: 30,
    actualMinutes: null,
    eventCount: 0,
    measuredEventCount: 0,
    measurementTruncated: false,
    lastActivityAt: null,
    items: [
      {
        id: `${id}-item`,
        orderIndex: 0,
        activityId: "analyse_own_games",
        activityType: "analyse",
        label: "Analyse your own games",
        dimensionLabels: ["Calculation"],
        plannedMinutes: 30,
        actualMinutes: null,
        status: "pending",
        eventCount: 0,
        measuredEventCount: 0,
        measurementTruncated: false,
        lastActivityAt: null,
        rationale: {
          text: "Review the decisions in your own game.",
          evidenceGrade: "C",
          evidenceTier: 1,
          citationKey: "qa.fixture",
          citationSource: "QA fixture",
          confidence: "low",
          soften: true,
        },
      },
    ],
  };
}

function groupedHistoryMarkup() {
  const current = historyEntry(
    "july-15",
    "2026-07-15T00:00:00.000Z",
    "2026-07-15T08:00:00.000Z",
    true,
  );
  const entries = [
    current,
    historyEntry(
      "july-5-v4",
      "2026-07-05T00:00:00.000Z",
      "2026-07-05T16:46:00.000Z",
    ),
    historyEntry(
      "july-5-v3",
      "2026-07-05T00:00:00.000Z",
      "2026-07-05T13:25:24.000Z",
    ),
    historyEntry(
      "july-5-v2",
      "2026-07-05T00:00:00.000Z",
      "2026-07-05T13:25:19.000Z",
    ),
    historyEntry(
      "july-5-v1",
      "2026-07-05T00:00:00.000Z",
      "2026-07-05T13:25:10.000Z",
    ),
  ];

  return renderToStaticMarkup(
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6">
      <ProgramArchive
        entries={entries}
        currentProgramId={current.id}
        loading={false}
        error={false}
        hasMore
        loadingMore={false}
        onRetry={noOp}
        onLoadMore={noOp}
      />
    </main>,
  );
}

function setupMarkup() {
  const steps = [
    ["/connections", "Connect a chess account", true, true],
    ["/onboarding/calibration", "Tactical calibration", true, true],
    ["/onboarding/constraints", "Your time, goals & formats", true, true],
    ["/onboarding/reveal", "See where you stand", false, false],
    ["/today", "Build your first session", false, false],
  ] as const;
  const status: OnboardingStatus = {
    complete: true,
    allComplete: false,
    nextStep: {
      href: steps[3][0],
      label: steps[3][1],
      done: false,
      required: false,
    },
    steps: steps.map(([href, label, done, required]) => ({
      href,
      label,
      done,
      required,
    })),
  };
  return renderToStaticMarkup(
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="eyebrow">Setup</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-ink">
          Set up your training
        </h1>
      </header>
      <OnboardingSteps status={status} />
    </main>,
  );
}

function firstSessionActionMarkup(state: "ready" | "pending" | "error") {
  return renderToStaticMarkup(
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <p className="eyebrow">Step 4 of setup</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-ink">
          Where you stand
        </h1>
        <p className="mt-3 max-w-2xl font-serif text-sm leading-relaxed text-graphite">
          Your calibration and constraints are saved. Build the first session
          when you are ready.
        </p>
      </header>
      <section className="rounded-lg border border-line bg-paper-raised p-5 sm:p-6">
        <h2 className="font-serif text-2xl font-semibold text-ink">
          Start training
        </h2>
        <FirstSessionAction
          error={state === "error" ? new Error("generation failed") : null}
          pending={state === "pending"}
          onBuild={noOp}
        />
      </section>
    </main>,
  );
}

function errorNoticesMarkup() {
  return renderToStaticMarkup(
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-2">
        <p className="eyebrow">Recovery states</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-ink">
          Clear next moves when a line stops
        </h1>
      </header>

      <ErrorNotice
        error={{
          message: "private database host and query text",
          data: { code: "INTERNAL_SERVER_ERROR" },
        }}
        heading="Session unavailable"
        message="The session could not be loaded."
        onRetry={noOp}
        retryLabel="Reload session"
      />

      <ErrorNotice
        error={{
          message:
            "Your weekly focus changed. Reload Today before choosing again.",
          data: { code: "CONFLICT" },
        }}
        heading="Focus not saved"
        message="The focus could not be saved."
        onRetry={noOp}
        retryLabel="Reload latest focus"
      />

      <ErrorNotice
        error={{ message: "Failed to fetch" }}
        heading="Games unavailable"
        message="The game list could not be loaded."
        onRetry={noOp}
        retrying
        retryLabel="Reload games"
      />
    </main>,
  );
}

function unexpectedErrorMarkup() {
  return renderToStaticMarkup(
    <main className="flex min-h-screen items-center px-5 py-12 sm:px-8">
      <UnexpectedError
        error={Object.assign(new Error("private exception text"), {
          digest: "qa-safe-reference",
        })}
        reset={noOp}
      />
    </main>,
  );
}

const state = process.argv[2];
const markup =
  state === "today-progress"
    ? todayMarkup(["done", "skipped", "todo"])
    : state === "today-done"
      ? todayMarkup(["done", "done", "done"])
      : state === "today-mixed"
        ? todayMarkup(["done", "skipped", "done"])
        : state === "setup"
          ? setupMarkup()
          : state === "first-session-ready"
            ? firstSessionActionMarkup("ready")
            : state === "first-session-pending"
              ? firstSessionActionMarkup("pending")
              : state === "first-session-error"
                ? firstSessionActionMarkup("error")
                : state === "history-grouped"
                  ? groupedHistoryMarkup()
                  : state === "error-notices"
                    ? errorNoticesMarkup()
                    : state === "unexpected-error"
                      ? unexpectedErrorMarkup()
                      : null;

if (markup === null) {
  throw new Error(`Unknown UI state: ${state ?? "missing"}`);
}

process.stdout.write(markup);
