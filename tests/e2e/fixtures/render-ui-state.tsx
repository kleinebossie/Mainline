import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { OnboardingSteps } from "@/app/onboarding/onboarding-steps";
import { ProgramArchive } from "@/app/today/program-history";
import { TodayBlockList, TodayHeader } from "@/app/today/today-session";
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
    params: { theme: null, track: null },
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
          : state === "history-grouped"
            ? groupedHistoryMarkup()
            : null;

if (markup === null) {
  throw new Error(`Unknown UI state: ${state ?? "missing"}`);
}

process.stdout.write(markup);
