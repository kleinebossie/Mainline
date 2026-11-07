"use client";

import { useState } from "react";
import { BookOpen, Check, ExternalLink } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { Surface } from "@/components/ui/surface";
import { Button, buttonVariants } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { asEvidenceGrade, GradeMark } from "@/components/evidence";
import { WhyButton } from "@/components/ui/why-button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { GradedCopy, LibraryView } from "@/server/library";

type Protocol = LibraryView["protocol"];

function categoryCoverStyle(category: string): { bg: string; text: string; border: string; accent: string } {
  const c = category.toLowerCase();
  if (c.includes("tactic") || c.includes("puzzle")) {
    return {
      bg: "bg-[#1E4333]",
      text: "text-[#EEF0EA]",
      border: "border-[#2E6B50]",
      accent: "text-[#5DC092]",
    };
  }
  if (c.includes("endgame")) {
    return {
      bg: "bg-[#332214]",
      text: "text-[#F8F9F5]",
      border: "border-[#8C5C15]",
      accent: "text-[#E5AD5A]",
    };
  }
  if (c.includes("calculation") || c.includes("blunder")) {
    return {
      bg: "bg-[#361914]",
      text: "text-[#F8F9F5]",
      border: "border-[#A8452F]",
      accent: "text-[#E06D53]",
    };
  }
  return {
    bg: "bg-[#1A2226]",
    text: "text-[#ECEEE9]",
    border: "border-[#3A464E]",
    accent: "text-[#9BA2A8]",
  };
}

function BookCover({
  book,
  onClick,
}: {
  book: LibraryView["books"][number];
  onClick: () => void;
}) {
  const style = categoryCoverStyle(book.category);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col justify-between rounded-sm border p-4 text-left transition-all duration-200 aspect-[3/4] hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
        style.bg,
        style.border,
        style.text,
      )}
    >
      {/* Top: Category & Owned Badge */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "font-mono text-[0.62rem] uppercase tracking-wider",
            style.accent,
          )}
        >
          {book.category}
        </span>
        {book.owned && (
          <span className="flex items-center gap-1 rounded-xs bg-evergreen px-1.5 py-0.5 font-mono text-[0.58rem] font-semibold uppercase tracking-wider text-paper">
            <Check className="h-2.5 w-2.5" />
            Owned
          </span>
        )}
      </div>

      {/* Center: Typographic Title */}
      <div className="my-auto py-2">
        <h3 className="font-serif text-lg sm:text-xl font-bold leading-snug line-clamp-3">
          {book.title}
        </h3>
        <p className="mt-2 font-sans text-xs opacity-80">
          {book.author}
        </p>
      </div>

      {/* Bottom: Evidence & Prompt */}
      <div className="flex items-center justify-between border-t border-white/10 pt-2 font-mono text-[0.65rem] opacity-75">
        <span>Grade {book.evidenceGrade}</span>
        <span className="group-hover:underline">Open details →</span>
      </div>
    </button>
  );
}

function ProtocolStep({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-1 border-b border-line pb-4 last:border-b-0 last:pb-0">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xs font-semibold text-evergreen shrink-0">
          Step {step}
        </span>
        <h4 className="text-ink font-serif text-base font-semibold leading-snug">
          {title}
        </h4>
      </div>
      <div className="text-graphite font-sans text-sm leading-relaxed mt-0.5">
        {children}
      </div>
    </li>
  );
}

function BookStudyProtocol({ protocol }: { protocol: Protocol }) {
  const hasWoodpecker = protocol.woodpecker.cycles.length > 0;

  return (
    <Surface gutter={asEvidenceGrade(protocol.activeRecall.grade)} className="p-5 sm:p-6 flex flex-col gap-5">
      <div>
        <h3 className="font-serif text-xl font-semibold text-ink">
          How to study a book
        </h3>
        <p className="text-graphite font-sans text-sm leading-relaxed mt-1">
          Use the physical or digital book you own. Mainline gives the active
          recall protocol and the reading log.
        </p>
      </div>

      <ol className="flex flex-col gap-4">
        <ProtocolStep step={1} title="Pick today's unit">
          Follow the book&apos;s chapter or exercise order. Stop when the session
          time finishes; do not turn it into a marathon.
        </ProtocolStep>
        <ProtocolStep step={2} title="Cover the answer">
          Set up the position, cover the solution, and calculate before reading.
          Write your candidate moves, then check after up to{" "}
          <span className="font-mono font-semibold text-ink">
            {protocol.activeRecall.timeLimitMin} min
          </span>
          .
        </ProtocolStep>
        <ProtocolStep step={3} title="Check and mark outcome">
          Check the solution. Aim for{" "}
          <span className="font-mono font-semibold text-ink">
            {protocol.calibration.targetPct}%
          </span>{" "}
          accuracy. Below {protocol.calibration.lowerPct}% suggests the book may
          be too hard; above {protocol.calibration.upperPct}% suggests it may be
          too easy.
        </ProtocolStep>
        <ProtocolStep step={4} title="Log progress">
          Record chapter, exercise number, minutes, and accuracy in Today&apos;s
          reading log.
        </ProtocolStep>
        {hasWoodpecker && (
          <ProtocolStep step={5} title="Apply Woodpecker cycles">
            Re-solve the same exercise set later with faster target times to
            crystallize visual pattern recognition.
          </ProtocolStep>
        )}
      </ol>

      <div className="pt-2 border-t border-line">
        <WhyButton
          rationaleText={protocol.activeRecall.text}
          evidenceGrade={protocol.activeRecall.grade}
          evidenceTier={protocol.activeRecall.tier}
          citationKey={protocol.activeRecall.citationKey}
          citationSource={protocol.activeRecall.citationSource}
          label="Why active book recall?"
        />
      </div>
    </Surface>
  );
}

export function Library() {
  const library = trpc.library.get.useQuery();
  const [selectedBook, setSelectedBook] = useState<LibraryView["books"][number] | null>(null);

  if (library.isLoading) {
    return <Notice tone="loading">Loading your library…</Notice>;
  }

  if (library.error) {
    return (
      <Notice tone="error" heading="Library unavailable">
        Mainline could not load book recommendations. Try refreshing the page.
      </Notice>
    );
  }

  const data = library.data;
  if (!data) {
    return (
      <Notice tone="neutral" heading="Library not tailored yet">
        Finish setup first to see recommendations tailored to your level and format.
      </Notice>
    );
  }

  // Sort owned books first (decision 30)
  const sortedBooks = [...data.books].sort((a, b) => {
    if (a.owned && !b.owned) return -1;
    if (!a.owned && b.owned) return 1;
    return 0;
  });

  return (
    <div className="flex flex-col gap-8">
      {/* Page Heading for E2E Test Compatibility */}
      <div className="border-b border-line pb-4">
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-ink">
          Library
        </h1>
        <p className="mt-1 font-mono text-xs text-graphite">
          Curated reading and study protocols tailored to your level (
          <span className="text-ink font-semibold">{data.bandLabel}</span>) and format (
          <span className="text-ink font-semibold capitalize">{data.targetFocus}</span>).
        </p>
      </div>

      {/* Book Shelf (Decision 30) */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-serif text-xl sm:text-2xl font-semibold text-ink">
            Recommended books
          </h2>
          <p className="text-graphite font-sans text-sm mt-0.5">
            Select a book to inspect study instructions, scientific rationale, and reading logs.
          </p>
        </div>

        {sortedBooks.length === 0 ? (
          <Notice tone="neutral">
            No book recommendations are available for your current rating band yet.
          </Notice>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {sortedBooks.map((b) => (
              <BookCover
                key={b.id}
                book={b}
                onClick={() => setSelectedBook(b)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Book Detail Sheet */}
      <Sheet open={selectedBook !== null} onOpenChange={(open) => !open && setSelectedBook(null)}>
        {selectedBook && (
          <SheetContent side="responsive" className="flex flex-col gap-5 overflow-y-auto max-h-screen">
            <SheetHeader>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-graphite">
                  {selectedBook.category}
                </span>
                {selectedBook.owned && (
                  <span className="rounded-xs bg-evergreen px-1.5 py-0.5 font-mono text-[0.62rem] font-semibold uppercase text-paper">
                    Owned
                  </span>
                )}
              </div>
              <SheetTitle className="text-xl sm:text-2xl">
                {selectedBook.title}
              </SheetTitle>
              <SheetDescription>
                By {selectedBook.author}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-4 text-sm text-ink leading-relaxed">
              <div className="rounded-md border border-line bg-paper-raised p-4">
                <h4 className="font-serif text-sm font-semibold text-ink">
                  Why this book?
                </h4>
                <p className="mt-1 text-graphite font-sans text-sm">
                  {selectedBook.why}
                </p>
                <div className="mt-3">
                  <WhyButton
                    rationaleText={selectedBook.why}
                    evidenceGrade={selectedBook.evidenceGrade}
                    evidenceTier={selectedBook.evidenceTier}
                    label="View methodology citations"
                  />
                </div>
              </div>

              <div className="rounded-md border border-line bg-paper-raised p-4">
                <h4 className="font-serif text-sm font-semibold text-ink">
                  How to train with this book
                </h4>
                <p className="mt-1 text-graphite font-sans text-sm leading-relaxed">
                  Set up positions on a real board or screen. Hide the solution, calculate candidate moves, and record your accuracy in Today&apos;s book log.
                </p>
              </div>
            </div>
          </SheetContent>
        )}
      </Sheet>

      {/* Screen vs Board Modality */}
      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-xl sm:text-2xl font-semibold text-ink">
          Screen vs board
        </h2>
        <Surface gutter={asEvidenceGrade(data.modality.split.grade)} className="p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="font-serif text-lg font-semibold text-ink">
              Your modality split
            </h3>
            <span className="font-mono text-sm text-graphite tabular-nums">
              {data.modality.digitalPct}% screen · {data.modality.physicalPct}% board
            </span>
          </div>

          {data.modality.surfacePhysical ? (
            <>
              <p className="text-ink font-sans text-sm leading-relaxed">
                {data.modality.physicalBoardAdvice}
              </p>
              <div className="border-l-2 border-evergreen/40 pl-3">
                <p className="font-mono text-xs uppercase tracking-wider text-evergreen">
                  Tournament simulation
                </p>
                <p className="text-ink mt-1 font-sans text-sm leading-relaxed">
                  {data.modality.otbCadence}
                </p>
              </div>
            </>
          ) : (
            <p className="text-graphite font-sans text-sm leading-relaxed">
              You train online, so a screen-first split is right: it maximizes
              how many tactical patterns you see per hour. If you ever play
              over-the-board, switch your play medium in Settings to add
              physical board drills.
            </p>
          )}

          <div className="pt-2 border-t border-line">
            <WhyButton
              rationaleText={data.modality.split.text}
              evidenceGrade={data.modality.split.grade}
              evidenceTier={data.modality.split.tier}
              citationKey={data.modality.split.citationKey}
              citationSource={data.modality.split.citationSource}
              label="Why this modality split?"
            />
          </div>
        </Surface>
      </section>

      {/* Book Study Protocol */}
      <section className="flex flex-col gap-4">
        <BookStudyProtocol protocol={data.protocol} />
      </section>

      {/* Reading Progress */}
      {data.progress.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-serif text-xl sm:text-2xl font-semibold text-ink">
            Reading progress
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.progress.map((p) => (
              <Surface key={p.resourceRefId} className="p-4 flex flex-col justify-between gap-3">
                <div>
                  <h3 className="text-ink font-serif text-sm font-semibold">
                    {p.title ?? p.resourceRefId}
                  </h3>
                  <p className="text-graphite mt-1 font-mono text-xs">
                    {p.sessions} session{p.sessions === 1 ? "" : "s"}
                    {p.totalMinutes > 0 && ` · ${p.totalMinutes} min`}
                    {p.position?.chapter != null &&
                      ` · chapter ${p.position.chapter}`}
                    {p.position?.unitCount != null &&
                      ` · ${p.position.unitCount} ${
                        p.studyUnit === "games" ? "games" : "exercises"
                      }`}
                  </p>
                </div>
                {p.lastSuccessRate != null && (
                  <span className="font-mono text-xs text-evergreen font-semibold">
                    Accuracy: {Math.round(p.lastSuccessRate * 100)}%
                  </span>
                )}
              </Surface>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
