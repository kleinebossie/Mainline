import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { TodayBlockList, TodayHeader } from "@/app/today/today-session";
import type { TodayItem, TodayProgram } from "@/server/program";

const evidence = {
  evidenceGrade: "B",
  evidenceTier: 1,
  citationKey: "test",
  citationSource: "Test source",
  confidence: "medium",
  soften: false,
};

function item(id: string, status: string): TodayItem {
  return {
    id,
    orderIndex: Number(id),
    label: `Block ${id}`,
    activityType: "study",
    dimensionLabels: [],
    estMinutes: 10,
    params: { theme: null, track: null },
    reviewThemes: [],
    externalUrl: null,
    externalLabel: null,
    url: null,
    delivery: "external",
    bookResource: null,
    rationaleText: "Test rationale",
    ...evidence,
    status,
  };
}

function program(statuses: string[]): TodayProgram {
  return {
    id: "program-1",
    createdAt: new Date(0),
    scheduledDate: new Date(0),
    methodologyVersion: "test",
    honesty: {
      expectations: "Test expectations",
      processGoal: "Test goal",
      expectationsEvidence: evidence,
      processGoalEvidence: evidence,
    },
    items: statuses.map((status, index) => item(String(index), status)),
  };
}

function header(statuses: string[], timeChanged = false) {
  return renderToStaticMarkup(
    <TodayHeader
      program={program(statuses)}
      due={0}
      actualMinutes={null}
      actualMeasuredEvents={0}
      actualEventCount={0}
      actualMeasurementTruncated={false}
      historyLoading={false}
      historyError={false}
      timeInput="20"
      setTimeInput={vi.fn()}
      timeBusy={false}
      timeValid={true}
      timeChanged={timeChanged}
      onRegenerate={vi.fn()}
    />,
  );
}

describe("Today session state", () => {
  it("distinguishes complete, mixed, and in-progress sessions", () => {
    expect(header(["done", "done"])).toContain("All training complete");
    expect(header(["done", "skipped"])).toContain(
      "Session finished with skips",
    );
    expect(header(["done", "todo"])).toContain("Session in progress");
  });

  it("disables Update plan until the time budget changes", () => {
    const unchanged = header(["todo"]);
    expect(unchanged).toContain("Change the minutes to update remaining work.");
    expect(unchanged).toMatch(/<button[^>]*disabled=""[^>]*>Update plan/);

    const changed = header(["todo"], true);
    expect(changed).not.toMatch(/<button[^>]*disabled=""[^>]*>Update plan/);
  });

  it("shows a quiet untouched state before any work is logged", () => {
    const html = header(["todo"]);

    expect(html).toContain("Not started");
    expect(html).not.toContain("No timed logs yet");
  });

  it("makes a skipped block visible and reversible", () => {
    const html = renderToStaticMarkup(
      <TodayBlockList
        items={[item("1", "skipped")]}
        ownedBooks={[]}
        libraryLoading={false}
        onLogOutcome={vi.fn()}
        onBookLogged={vi.fn()}
        onUndoSkip={vi.fn()}
      />,
    );

    expect(html).toContain("Skipped");
    expect(html).toContain("Undo skip");
  });
});
