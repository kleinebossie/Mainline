"use client";

import { useState } from "react";

import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GradeMark } from "@/components/evidence";
import { TransparencyCard } from "@/components/transparency-card";
import type { GradedCopy } from "@/server/library";

// The "Library" client (BUILD.md M14). Renders the deliberately-external layer: graded book
// recommendations (with the cognitive-load block rule already applied server-side), the
// book-study protocol, the 2D/3D modality + OTB guidance (gated by the user's play medium),
// a logging form that feeds the SAME adaptation loop, and rolled-up progress. Every
// recommendation shows how strong its evidence is — never a rating promise.

type Grade = "A" | "B" | "C" | "D";
function asGrade(g: string): Grade {
  return g === "A" || g === "B" || g === "C" || g === "D" ? g : "C";
}

/** A graded "why" block rendered as the brand's TransparencyCard (confidence is a band prior). */
function Why({ copy }: { copy: GradedCopy }) {
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
    />
  );
}

export function Library() {
  const utils = trpc.useUtils();
  const library = trpc.library.get.useQuery();
  const [bookId, setBookId] = useState<string>("");
  const [unitCount, setUnitCount] = useState<string>("");
  const [successPct, setSuccessPct] = useState<string>("");
  const [chapter, setChapter] = useState<string>("");
  const [cycle, setCycle] = useState<string>("");
  const [minutes, setMinutes] = useState<string>("");

  const log = trpc.library.logSession.useMutation({
    onSuccess: () => {
      void utils.library.get.invalidate();
      void utils.tracker.dueReviews.invalidate();
      setUnitCount("");
      setChapter("");
      setMinutes("");
      setCycle("");
      setSuccessPct("");
    },
  });

  if (library.isLoading) {
    return (
      <p className="text-graphite font-mono text-sm">Loading your library…</p>
    );
  }
  const data = library.data;
  if (!data) {
    return (
      <p className="text-graphite font-mono text-sm">
        Finish onboarding first — we tailor these to your level and how you play.
      </p>
    );
  }

  const selectedBook = data.books.find((b) => b.id === bookId) ?? data.books[0];
  const unitLabel = selectedBook?.studyUnit === "games" ? "Games studied" : "Exercises done";
  const unitPlaceholder = selectedBook?.studyUnit === "games" ? "e.g. 3" : "e.g. 10";

  const onLog = () => {
    const resourceRefId = bookId || data.books[0]?.id;
    if (!resourceRefId) return;
    const count = Number(unitCount);
    if (!unitCount || !Number.isInteger(count) || count <= 0) {
      alert("Please enter a valid positive number for exercises/games.");
      return;
    }
    const pct = successPct ? Number(successPct) : NaN;
    log.mutate({
      resourceRefId,
      successRate: !isNaN(pct) && Number.isFinite(pct) ? pct / 100 : undefined,
      durationMin: minutes ? Number(minutes) : undefined,
      woodpeckerCycle: cycle ? Number(cycle) : undefined,
      position: {
        unitCount: count,
        chapter: chapter ? Number(chapter) : undefined,
      },
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <p className="text-graphite font-mono text-xs">
        Tailored to your level (<span className="text-ink">{data.bandLabel}</span>
        ) and how you play (
        <span className="text-ink capitalize">{data.targetFocus}</span>).
      </p>

      {/* --- 2D/3D modality + over-the-board calibration (gated by play medium) --- */}
      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl font-semibold tracking-tight">
          Screen vs. board
        </h2>
        <Card gutter={asGrade(data.modality.split.grade)}>
          <CardHeader>
            <CardTitle className="flex items-baseline justify-between gap-3">
              <span>Your modality split</span>
              <span className="text-graphite font-mono text-sm tabular-nums">
                {data.modality.digitalPct}% screen · {data.modality.physicalPct}%
                board
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
                You train online, so a screen-first split is right — it maximises
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
        <Card gutter={asGrade(data.protocol.activeRecall.grade)}>
          <CardHeader>
            <CardTitle>How to study a book</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ul className="flex flex-col gap-2 font-serif text-sm leading-relaxed">
              <li className="flex items-start gap-2">
                <span aria-hidden className="text-evergreen font-mono text-xs shrink-0 pt-1">▸</span>
                <span>
                  Cover the answer, set the position up, and calculate for up to ~
                  {data.protocol.activeRecall.timeLimitMin} min before you check.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span aria-hidden className="text-evergreen font-mono text-xs shrink-0 pt-1">▸</span>
                <span>
                  Aim for ~{data.protocol.calibration.targetPct}% success (
                  {data.protocol.calibration.lowerPct}–{data.protocol.calibration.upperPct}% range).
                </span>
              </li>
              {data.protocol.woodpecker.cycles.length > 0 && (
                <li className="flex items-start gap-2">
                  <span aria-hidden className="text-evergreen font-mono text-xs shrink-0 pt-1">▸</span>
                  <span>
                    For tactics books: complete at least {data.protocol.woodpecker.recommendedMinCycles} woodpecker cycles, re-solving the same set with a shrinking gap.
                  </span>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* --- Recommended books --- */}
      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl font-semibold tracking-tight">
          Recommended for you
        </h2>
        <p className="text-graphite font-serif text-sm leading-relaxed -mt-2">
          We never host these — they stay where you bought or borrowed them. Books
          that would overload your level are left out on purpose.
        </p>
        {data.books.length === 0 ? (
          <p className="text-graphite font-mono text-sm">
            No book recommendations at your level yet.
          </p>
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

      {/* --- Log a study session (feeds the same adaptation loop) --- */}
      {data.books.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-serif text-2xl font-semibold tracking-tight">
            Log a study session
          </h2>
          <Card gutter="A">
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 font-serif text-sm">
                  <span className="eyebrow !text-[0.62rem]">Book</span>
                  <select
                    value={bookId || data.books[0]!.id}
                    onChange={(e) => setBookId(e.target.value)}
                    className="border-input bg-paper-raised h-9 rounded-md border px-2 font-serif text-sm"
                  >
                    {data.books.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 font-serif text-sm">
                  <span className="eyebrow !text-[0.62rem]">
                    {unitLabel} <span className="text-red-500">*</span>
                  </span>
                  <Input
                    type="number"
                    min={1}
                    placeholder={unitPlaceholder}
                    value={unitCount}
                    onChange={(e) => setUnitCount(e.target.value)}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1.5 font-serif text-sm">
                  <span className="eyebrow !text-[0.62rem]">
                    Exercises solved (%) (optional)
                  </span>
                  <select
                    value={successPct}
                    onChange={(e) => setSuccessPct(e.target.value)}
                    className="border-input bg-paper-raised h-9 rounded-md border px-2 font-serif text-sm"
                  >
                    <option value="">Optional (select...)</option>
                    {["50", "60", "70", "75", "80", "85", "90", "95"].map((p) => (
                      <option key={p} value={p}>
                        {p}%
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 font-serif text-sm">
                  <span className="eyebrow !text-[0.62rem]">
                    Chapter (optional)
                  </span>
                  <Input
                    type="number"
                    min={0}
                    value={chapter}
                    onChange={(e) => setChapter(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1.5 font-serif text-sm">
                  <span className="eyebrow !text-[0.62rem]">
                    Minutes (optional)
                  </span>
                  <Input
                    type="number"
                    min={0}
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                  />
                </label>
                {selectedBook?.category === "tactics" && (
                  <label className="flex flex-col gap-1.5 font-serif text-sm">
                    <span className="eyebrow !text-[0.62rem]">
                      Woodpecker cycle (optional)
                    </span>
                    <Input
                      type="number"
                      min={1}
                      value={cycle}
                      onChange={(e) => setCycle(e.target.value)}
                    />
                  </label>
                )}
              </div>
              <Button
                type="button"
                className="self-start"
                disabled={log.isPending}
                onClick={onLog}
              >
                {log.isPending ? "Logging…" : "Log this session"}
              </Button>

              {log.data?.feedback && (
                <p className="text-graphite border-l-2 border-evergreen/40 pl-3 font-serif text-sm leading-relaxed">
                  {log.data.feedback.verdict === "too_easy" &&
                    "That book looks a bit easy — consider a harder one."}
                  {log.data.feedback.verdict === "too_hard" &&
                    "That book looks tough right now — an easier one will help."}
                  {log.data.feedback.verdict === "calibrated" &&
                    "Nicely calibrated — that difficulty is right where learning is fastest."}
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      )}

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
