"use client";

import type { ReactNode } from "react";

import { trpc } from "@/lib/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GradeMark } from "@/components/evidence";
import { TransparencyCard } from "@/components/transparency-card";
import { StatusMessage } from "@/components/ui/status-message";
import type { GradedCopy, LibraryView } from "@/server/library";

// The "Library" client (BUILD.md M14). Renders the deliberately-external layer: graded book
// recommendations (with the cognitive-load block rule already applied server-side), the
// book-study protocol, the 2D/3D modality + OTB guidance (gated by the user's play medium),
// and rolled-up progress. Study-session logging lives on Today, where scheduled external
// work is completed. Every recommendation shows how strong its evidence is — never a rating promise.

type Grade = "A" | "B" | "C" | "D";
function asGrade(g: string): Grade {
  return g === "A" || g === "B" || g === "C" || g === "D" ? g : "C";
}

/** A graded "why" block rendered as the brand's TransparencyCard (confidence is a band prior). */
function Why({
  copy,
  defaultCollapsed,
}: {
  copy: GradedCopy;
  defaultCollapsed?: boolean;
}) {
  return (
    <TransparencyCard
      rationaleText={copy.text}
      evidenceGrade={copy.grade}
      evidenceTier={copy.tier}
      citationKey={copy.citationKey}
      citationSource={copy.citationSource}
      confidence="low"
      soften={copy.soften}
      flag={copy.flag}
      defaultCollapsed={defaultCollapsed}
    />
  );
}

type Protocol = LibraryView["protocol"];

function ProtocolStep({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
      <span
        aria-hidden
        className="border-evergreen/35 bg-paper/80 text-evergreen flex h-8 w-8 items-center justify-center rounded-sm border font-mono text-xs tabular-nums"
      >
        {step}
      </span>
      <div className="min-w-0 border-b border-line/70 pb-4 last:border-b-0">
        <h3 className="text-ink font-serif text-base font-semibold leading-snug">
          {title}
        </h3>
        <div className="text-graphite mt-1 font-serif text-sm leading-relaxed">
          {children}
        </div>
      </div>
    </li>
  );
}

function BookStudyProtocol({ protocol }: { protocol: Protocol }) {
  const hasWoodpecker = protocol.woodpecker.cycles.length > 0;

  return (
    <Card gutter={asGrade(protocol.activeRecall.grade)}>
      <CardHeader>
        <CardTitle>How to study a book</CardTitle>
        <p className="text-graphite font-serif text-sm leading-relaxed">
          Use the book you own. Mainline gives the workflow and the log; the
          actual pages stay in the book.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <ol className="flex flex-col gap-4">
          <ProtocolStep step={1} title="Pick today's unit">
            Follow the book&apos;s own chapter, exercise, or game order. Stop
            when the assigned session time is done; do not turn it into a
            marathon.
          </ProtocolStep>
          <ProtocolStep step={2} title="Cover the answer">
            Set the position, hide the solution, and calculate before reading.
            Say or write your candidate move and plan, then check after up to{" "}
            <span className="text-ink font-mono tabular-nums">
              {protocol.activeRecall.timeLimitMin} min
            </span>
            .
          </ProtocolStep>
          <ProtocolStep step={3} title="Check and mark outcome">
            Mark the attempt as correct, almost, or missed, or log a success
            percentage. Aim for{" "}
            <span className="text-ink font-mono tabular-nums">
              {protocol.calibration.targetPct}%
            </span>{" "}
            success. Below{" "}
            <span className="text-ink font-mono tabular-nums">
              {protocol.calibration.lowerPct}%
            </span>{" "}
            suggests the book may be too hard; above{" "}
            <span className="text-ink font-mono tabular-nums">
              {protocol.calibration.upperPct}%
            </span>{" "}
            suggests it may be too easy.
          </ProtocolStep>
          <ProtocolStep step={4} title="Log the position">
            Record the chapter, exercise or game number, minutes, and success
            rate. For tactics workbooks, add the Woodpecker cycle number so the
            next repeat stays in sequence.
          </ProtocolStep>
          {hasWoodpecker && (
            <ProtocolStep step={5} title="Use spaced Woodpecker cycles">
              A Woodpecker cycle means re-solving the same set later, faster:
              work through it carefully first, then repeat it after spaced gaps
              with a tighter clock. This builds fluency and pattern recognition;
              it is not proof of rating gain.
            </ProtocolStep>
          )}
        </ol>

        {hasWoodpecker && (
          <div className="border-evergreen/30 bg-evergreen/5 rounded-md border p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-serif text-base font-semibold">
                Woodpecker spacing
              </h3>
              <span className="text-graphite font-mono text-[0.7rem] uppercase tracking-[0.12em]">
                at least {protocol.woodpecker.recommendedMinCycles} cycles
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {protocol.woodpecker.cycles.map((cycle) => (
                <div
                  key={cycle.cycle}
                  className="rounded-sm border border-line/80 bg-paper/70 px-3 py-2"
                >
                  <p className="text-ink font-mono text-xs tabular-nums">
                    Cycle {cycle.cycle}
                  </p>
                  <p className="text-graphite mt-1 font-serif text-sm">
                    Re-solve after {cycle.intervalDays} day
                    {cycle.intervalDays === 1 ? "" : "s"}.
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Why copy={protocol.activeRecall} />
          <Why copy={protocol.calibration} />
          <Why copy={protocol.woodpecker} />
        </div>
      </CardContent>
    </Card>
  );
}

export function Library() {
  const library = trpc.library.get.useQuery();

  if (library.isLoading) {
    return <StatusMessage tone="loading">Loading your library…</StatusMessage>;
  }
  if (library.error) {
    return (
      <StatusMessage tone="error" heading="Library unavailable">
        We could not load your recommendations. Refresh the page and try again.
      </StatusMessage>
    );
  }
  const data = library.data;
  if (!data) {
    return (
      <StatusMessage tone="neutral" heading="Library not tailored yet">
        Finish onboarding first; we tailor these to your level and how you play.
      </StatusMessage>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="text-graphite font-mono text-xs">
        Tailored to your level (
        <span className="text-ink">{data.bandLabel}</span>) and how you play (
        <span className="text-ink capitalize">{data.targetFocus}</span>).
      </p>

      {/* --- 2D/3D modality + over-the-board calibration (gated by play medium) --- */}
      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl font-semibold tracking-tight">
          Screen vs. board
        </h2>
        <Card gutter={asGrade(data.modality.split.grade)}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-baseline justify-between gap-3">
              <span>Your modality split</span>
              <span className="text-graphite font-mono text-sm tabular-nums">
                {data.modality.digitalPct}% screen · {data.modality.physicalPct}
                % board
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {data.modality.surfacePhysical ? (
              <>
                <p className="text-ink font-serif text-sm leading-relaxed">
                  {data.modality.physicalBoardAdvice}
                </p>
                <div className="border-l-2 border-evergreen/40 pl-3">
                  <p className="eyebrow !text-[0.62rem]">
                    Over-the-board tournament simulation
                  </p>
                  <p className="text-ink mt-1 font-serif text-sm leading-relaxed">
                    {data.modality.otbCadence}
                  </p>
                </div>
                <Why copy={data.modality.otb} />
              </>
            ) : (
              <p className="text-graphite font-serif text-sm leading-relaxed">
                You train online, so a screen-first split is right: it maximises
                how many patterns you see per hour. If you ever play
                over-the-board, switch your play medium in Setup and we&apos;ll
                add physical-board work.
              </p>
            )}
            <Why copy={data.modality.split} />
          </CardContent>
        </Card>
      </section>

      {/* --- Book-study protocol --- */}
      <section className="flex flex-col gap-4">
        <BookStudyProtocol protocol={data.protocol} />
      </section>

      {/* --- Recommended books --- */}
      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl font-semibold tracking-tight">
          Recommended for you
        </h2>
        <p className="text-graphite font-serif text-sm leading-relaxed -mt-2">
          We never host these. They stay where you bought or borrowed them.
          Books that would overload your level are left out on purpose.
        </p>
        {data.books.length === 0 ? (
          <StatusMessage tone="neutral" heading="No recommendations yet">
            There are no book recommendations for your current setup yet.
          </StatusMessage>
        ) : (
          data.books.map((b) => (
            <Card key={b.id} gutter={asGrade(b.evidenceGrade)} provisional>
              <CardHeader className="pb-3">
                <CardTitle className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>{b.title}</span>
                  {b.owned && (
                    <span className="text-evergreen border-evergreen/40 bg-evergreen/10 rounded-sm border px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-wide">
                      You own this
                    </span>
                  )}
                </CardTitle>
                <p className="text-graphite mt-1 font-mono text-xs">
                  {b.author} · {b.category}
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-ink font-serif text-sm leading-relaxed">
                  {b.why}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <GradeMark grade={b.evidenceGrade} tier={b.evidenceTier} />
                  <span className="text-graphite font-mono text-[0.7rem]">
                    Source · {b.citationSource ?? b.citationKey}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      {/* --- Progress --- */}
      {data.progress.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-serif text-2xl font-semibold tracking-tight">
            Your progress
          </h2>
          {data.progress.map((p) => (
            <Card key={p.resourceRefId}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
                <div>
                  <p className="text-ink font-serif text-sm font-medium">
                    {p.title ?? p.resourceRefId}
                  </p>
                  <p className="text-graphite mt-1 font-mono text-xs">
                    {p.sessions} session{p.sessions === 1 ? "" : "s"}
                    {p.totalMinutes > 0 && ` · ${p.totalMinutes} min`}
                    {p.position?.chapter != null &&
                      ` · chapter ${p.position.chapter}`}
                    {p.position?.unitCount != null &&
                      ` · ${p.position.unitCount} ${
                        p.studyUnit === "games" ? "games" : "exercises"
                      }`}
                    {p.woodpeckerCycle != null &&
                      ` · cycle ${p.woodpeckerCycle}`}
                  </p>
                </div>
                {p.lastSuccessRate != null && (
                  <span className="text-graphite font-mono text-xs tabular-nums">
                    last {Math.round(p.lastSuccessRate * 100)}%
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
