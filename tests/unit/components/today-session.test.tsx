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
    expect(header(["done", "done"])).toContain("Training complete");
    expect(header(["done", "skipped"])).toContain("Finished with skips");
    expect(header(["done", "todo"])).toContain("Session in progress");
  });

  it("disables Update plan until the time budget changes", () => {
    const unchanged = header(["todo"]);
    expect(unchanged).toMatch(/<button[^>]*disabled=""[^>]*>Update plan/);

    const changed = header(["todo"], true);
    expect(changed).not.toMatch(/<button[^>]*disabled=""[^>]*>Update plan/);
  });

  it("shows a quiet untouched state before any work is logged", () => {
    const html = header(["todo"]);

    expect(html).toContain("0 min");
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

  it("shows a prominent start action for a fresh session", () => {
    const html = header(["todo", "todo", "todo"]);

    expect(html).toContain("Start session");
    expect(html).toContain("Start here");
    expect(html).toContain("0 of 3 blocks done, 3 left");
    // the action aims at the first block rather than a page anchor above it
    expect(html).toContain('href="#today-block-card-0"');
  });

  it("shows a continue action pointing at the active incomplete block", () => {
    const html = header(["done", "todo", "todo"]);

    expect(html).toContain("Continue at block 2");
    expect(html).toContain("Session in progress");
    expect(html).toContain("Up next");
    expect(html).toContain("1 of 3 blocks done, 2 left");
  });

  it("does not show Start Session CTA when all blocks are complete", () => {
    const html = header(["done", "done", "done"]);

    expect(html).not.toContain("today-start-session-link");
    expect(html).toContain("Training complete");
  });

  it("marks the first incomplete block as the one to do next", () => {
    const html = renderToStaticMarkup(
      <TodayBlockList
        items={[item("0", "done"), item("1", "todo"), item("2", "todo")]}
        ownedBooks={[]}
        libraryLoading={false}
        onLogOutcome={vi.fn()}
        onBookLogged={vi.fn()}
        onUndoSkip={vi.fn()}
      />,
    );

    // the row itself is announced as current; the visible "Up next" wording
    // lives once, in the session header, instead of repeating per row
    expect(html).toContain('aria-current="true"');
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
  });
});
