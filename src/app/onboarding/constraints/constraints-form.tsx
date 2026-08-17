"use client";

import { useState } from "react";
import Link from "next/link";

import { trpc } from "@/lib/trpc/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusMessage } from "@/components/ui/status-message";
import { ErrorNotice } from "@/components/ui/error-notice";
import { MethodologyRationaleCard } from "@/components/methodology-rationale-card";
import {
  MAX_MINUTES_PER_DAY,
  MIN_MINUTES_PER_DAY,
} from "@/lib/constraint-limits";
import { platformLabel } from "@/lib/format-game";
import {
  CHESS_FORMATS,
  DEPTH_VS_BREADTH,
  EMPTY_CONSTRAINTS,
  OWNED_RESOURCE_KINDS,
  TARGET_FOCUSES,
  type ConstraintsInput,
  type Goal,
  type OwnedResource,
  type SessionStyle,
  type TargetFocus,
} from "@/lib/constraints";
import type { RationaleEntry } from "@/methodology";
import { errorMessage } from "@/lib/error-presentation";
import { shouldPersistPrimaryPlatform } from "@/lib/primary-platform";

// Labels for the play-medium choice (M14): drives the 2D/3D modality + OTB recommendations.
const TARGET_FOCUS_LABELS: Record<TargetFocus, string> = {
  online: "Online only",
  hybrid: "Both online and over-the-board",
  otb: "Over-the-board tournaments",
};

// Labels for the owned-resource kinds (UI copy; the schema stores the kind enum).
const RESOURCE_KIND_LABELS: Record<OwnedResource["kind"], string> = {
  book: "Book",
  course: "Course",
  membership: "Membership",
  trainer: "Trainer / app",
  other: "Other",
};

const DEPTH_LABELS: Record<SessionStyle["depthVsBreadth"], string> = {
  depth: "Go deep: fewer topics, harder",
  balanced: "Balanced",
  breadth: "Go broad: more variety",
};

// Goal kinds offered as checkboxes (label is UI copy; the schema stores { kind, label }).
// These are aspirations/constraints: never a skill self-rating (Seam 2 boundary).
const GOAL_OPTIONS: ReadonlyArray<{ kind: Goal["kind"]; label: string }> = [
  { kind: "rating", label: "Raise my rating" },
  { kind: "tactics", label: "Sharpen tactics" },
  { kind: "openings", label: "Improve my openings" },
  { kind: "endgames", label: "Improve my endgames" },
  { kind: "consistency", label: "Train consistently" },
  { kind: "fun", label: "Enjoy the game more" },
];

// Reused in onboarding (continue → reveal) and in Settings (continue → today). The
// continuation is the only thing that differs between the two contexts.
import { getGuestSession } from "@/lib/guest-session";

export function ConstraintsForm({
  ifThenRationale,
  continueHref = "/onboarding/reveal",
  continueLabel = "Continue →",
}: {
  ifThenRationale: RationaleEntry;
  continueHref?: string;
  continueLabel?: string;
}) {
  const current = trpc.constraints.getCurrent.useQuery();
  if (current.isLoading) {
    return <StatusMessage tone="loading">Loading your plan…</StatusMessage>;
  }
  if (current.error) {
    return (
      <ErrorNotice
        error={current.error}
        heading="Training preferences unavailable"
        message="Mainline could not load your saved preferences. Try this step again."
        onRetry={() => void current.refetch()}
        retrying={current.isFetching}
        retryLabel="Reload preferences"
      />
    );
  }

  const guestSession =
    typeof window !== "undefined" ? getGuestSession() : null;
  const initialConstraints =
    current.data ??
    (guestSession?.constraints
      ? {
          ...EMPTY_CONSTRAINTS,
          minutesPerDay: guestSession.constraints.minutesPerDay,
          daysPerWeek: guestSession.constraints.daysPerWeek,
          formatPrefs: guestSession.constraints.formatPrefs,
          goals: guestSession.constraints.goals.map((g) => ({
            kind: g as Goal["kind"],
            label: g,
          })),
          ownedResources: guestSession.constraints.ownedResources.map((r) => ({
            kind: r.kind as OwnedResource["kind"],
            label: r.label,
            externalRef: r.externalRef,
          })),
        }
      : EMPTY_CONSTRAINTS);

  return (
    <Form
      initial={initialConstraints}
      ifThenRationale={ifThenRationale}
      continueHref={continueHref}
      continueLabel={continueLabel}
    />
  );
}

function Form({
  initial,
  ifThenRationale,
  continueHref,
  continueLabel,
}: {
  initial: ConstraintsInput;
  ifThenRationale: RationaleEntry;
  continueHref: string;
  continueLabel: string;
}) {
  const utils = trpc.useUtils();
  const save = trpc.constraints.save.useMutation({
    onSuccess: () => {
      setSaved(true);
      void utils.constraints.getCurrent.invalidate();
    },
    onError: (e) =>
      setError(
        errorMessage(
          e,
          "Your preferences were not saved. Check the form and try again.",
        ),
      ),
  });

  // Preferred home platform (Goal 3): stored on the User row, not the ConstraintSet, saved
  // alongside via setPrimaryPlatform. Defaults to the saved choice, then a connected account.
  const connections = trpc.connections.list.useQuery();
  const primaryQuery = trpc.connections.getPrimaryPlatform.useQuery();
  const setPrimary = trpc.analysis.setPrimaryPlatform.useMutation({
    onSuccess: () => {
      setPrimaryPlatform(null);
      void utils.connections.getPrimaryPlatform.invalidate();
    },
    onError: (e) =>
      setError(
        errorMessage(
          e,
          "Your preferred platform was not saved. The other preferences can still be saved, then try this platform again.",
        ),
      ),
  });
  const connectedPlatforms = [
    ...new Set((connections.data ?? []).map((c) => c.platform)),
  ];
  const [primaryPlatform, setPrimaryPlatform] = useState<
    "lichess" | "chesscom" | null
  >(null);

  const [minutesInput, setMinutesInput] = useState<string>(
    String(initial.minutesPerDay),
  );
  const [daysInput, setDaysInput] = useState<string>(
    String(initial.daysPerWeek),
  );
  const [goalKinds, setGoalKinds] = useState<Set<Goal["kind"]>>(
    new Set(initial.goals.filter((g) => g.kind !== "other").map((g) => g.kind)),
  );
  const [otherGoal, setOtherGoal] = useState(
    initial.goals.find((g) => g.kind === "other")?.label ?? "",
  );
  const [formats, setFormats] = useState<Set<string>>(
    new Set(initial.formatPrefs.formats),
  );
  const [preferredVariety, setVariety] = useState(
    initial.formatPrefs.preferredVariety,
  );
  const [targetFocus, setTargetFocus] = useState<TargetFocus>(
    initial.formatPrefs.targetFocus,
  );
  const [ownedResources, setOwnedResources] = useState<OwnedResource[]>(
    initial.ownedResources,
  );
  const [newResourceKind, setNewResourceKind] =
    useState<OwnedResource["kind"]>("book");
  const [newResourceLabel, setNewResourceLabel] = useState("");
  const [newResourceExternalRef, setNewResourceExternalRef] = useState<
    string | undefined
  >(undefined);
  const [depthVsBreadth, setDepth] = useState<SessionStyle["depthVsBreadth"]>(
    initial.sessionStyle.depthVsBreadth,
  );
  const [interleave, setInterleave] = useState(initial.sessionStyle.interleave);
  const [cue, setCue] = useState(initial.ifThenPlan?.cue ?? "");
  const [plan, setPlan] = useState(initial.ifThenPlan?.plan ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const libraryQuery = trpc.library.get.useQuery();

  const recommendedBooks = libraryQuery.data?.books ?? [];
  const availableBooks = recommendedBooks.filter(
    (b) =>
      !ownedResources.some(
        (r) =>
          r.externalRef === b.id ||
          r.label.toLowerCase() === b.title.toLowerCase(),
      ),
  );

  const toggle = <T,>(set: Set<T>, value: T): Set<T> => {
    setSaved(false);
    const nextSet = new Set(set);
    if (nextSet.has(value)) nextSet.delete(value);
    else nextSet.add(value);
    return nextSet;
  };

  const handleResourceKindChange = (kind: OwnedResource["kind"]) => {
    setNewResourceKind(kind);
    setNewResourceLabel("");
    setNewResourceExternalRef(undefined);
  };

  const addResource = () => {
    const label = newResourceLabel.trim();
    if (!label || ownedResources.length >= 100) return;
    setSaved(false);
    setOwnedResources((rs) => [
      ...rs,
      {
        kind: newResourceKind,
        label,
        ...(newResourceKind === "book" && newResourceExternalRef
          ? { externalRef: newResourceExternalRef }
          : {}),
      },
    ]);
    setNewResourceLabel("");
    setNewResourceExternalRef(undefined);
  };
  const removeResource = (index: number) => {
    setSaved(false);
    setOwnedResources((rs) => rs.filter((_, i) => i !== index));
  };

  // The platform the picker should show: the in-form choice, else the saved preference, else
  // a connected account, else Lichess.
  const savedPrimaryPlatform =
    primaryQuery.data?.primaryPlatform === "lichess" ||
    primaryQuery.data?.primaryPlatform === "chesscom"
      ? primaryQuery.data.primaryPlatform
      : primaryQuery.data?.primaryPlatform === null
        ? null
        : undefined;
  const effectivePrimary: "lichess" | "chesscom" = (primaryPlatform ??
    savedPrimaryPlatform ??
    connectedPlatforms[0] ??
    "lichess") as "lichess" | "chesscom";

  const parsedMinutes = parseInt(minutesInput.trim(), 10);
  const currentMinutes = Number.isNaN(parsedMinutes) ? 0 : parsedMinutes;
  const parsedDays = parseInt(daysInput.trim(), 10);
  const currentDays = Number.isNaN(parsedDays) ? 0 : parsedDays;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    setError(null);

    if (
      Number.isNaN(parsedMinutes) ||
      parsedMinutes < MIN_MINUTES_PER_DAY ||
      parsedMinutes > MAX_MINUTES_PER_DAY
    ) {
      setError(
        `Enter a daily time budget between ${MIN_MINUTES_PER_DAY} and ${MAX_MINUTES_PER_DAY} minutes.`,
      );
      return;
    }

    if (Number.isNaN(parsedDays) || parsedDays < 1 || parsedDays > 7) {
      setError("Enter training days per week between 1 and 7.");
      return;
    }

    if (formats.size === 0) {
      setError(
        "Select at least one format you play (bullet, blitz, rapid, or classical).",
      );
      return;
    }
    // Persist the preferred platform on the User row (Goal 3) alongside the constraints.
    if (
      shouldPersistPrimaryPlatform({
        explicitSelection: primaryPlatform,
        effectivePlatform: effectivePrimary,
        savedPlatform: savedPrimaryPlatform,
        savedPlatformLoaded: primaryQuery.isSuccess,
      })
    ) {
      setPrimary.mutate({ platform: effectivePrimary });
    }
    const goals: Goal[] = [
      ...GOAL_OPTIONS.filter((g) => goalKinds.has(g.kind)).map((g) => ({
        kind: g.kind,
        label: g.label,
      })),
      ...(otherGoal.trim()
        ? [{ kind: "other" as const, label: otherGoal.trim() }]
        : []),
    ];
    const cueT = cue.trim();
    const planT = plan.trim();
    save.mutate({
      minutesPerDay: parsedMinutes,
      daysPerWeek: parsedDays,
      goals,
      ownedResources,
      formatPrefs: {
        formats: CHESS_FORMATS.filter((f) => formats.has(f)),
        preferredVariety,
        targetFocus,
      },
      sessionStyle: { depthVsBreadth, interleave },
      ifThenPlan: cueT && planT ? { cue: cueT, plan: planT } : null,
    });
  };

  const initialGoalKinds = new Set(
    initial.goals.filter((g) => g.kind !== "other").map((g) => g.kind),
  );
  const initialOtherGoal =
    initial.goals.find((g) => g.kind === "other")?.label ?? "";
  const initialFormats = new Set(initial.formatPrefs.formats);
  const initialOwnedResources = new Set(initial.ownedResources);

  const areSetsEqual = <T,>(a: Set<T>, b: Set<T>) =>
    a.size === b.size && [...a].every((x) => b.has(x));

  const isDirty =
    currentMinutes !== initial.minutesPerDay ||
    currentDays !== initial.daysPerWeek ||
    !areSetsEqual(goalKinds, initialGoalKinds) ||
    otherGoal !== initialOtherGoal ||
    !areSetsEqual(formats, initialFormats) ||
    preferredVariety !== initial.formatPrefs.preferredVariety ||
    targetFocus !== initial.formatPrefs.targetFocus ||
    depthVsBreadth !== initial.sessionStyle.depthVsBreadth ||
    interleave !== initial.sessionStyle.interleave ||
    cue !== (initial.ifThenPlan?.cue ?? "") ||
    plan !== (initial.ifThenPlan?.plan ?? "") ||
    (primaryPlatform !== null && primaryPlatform !== savedPrimaryPlatform) ||
    !areSetsEqual(new Set(ownedResources), initialOwnedResources);

  return (
    <form className="flex flex-col gap-10 settle" onSubmit={onSubmit}>
      {(connections.error || primaryQuery.error || libraryQuery.error) && (
        <ErrorNotice
          error={connections.error ?? primaryQuery.error ?? libraryQuery.error}
          heading="Some saved choices are unavailable"
          message="The form is open, but Mainline could not load connected platforms or book suggestions. Reload those choices before saving."
          onRetry={() => {
            void connections.refetch();
            void primaryQuery.refetch();
            void libraryQuery.refetch();
          }}
          retrying={
            connections.isFetching ||
            primaryQuery.isFetching ||
            libraryQuery.isFetching
          }
          retryLabel="Reload saved choices"
        />
      )}
      <fieldset className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <label className="flex flex-col gap-2 font-serif text-sm font-medium">
          <span className="eyebrow !text-[0.65rem] !tracking-wider">
            Minutes per day
          </span>
          <Input
            id="minutesPerDay"
            name="minutesPerDay"
            type="number"
            min={MIN_MINUTES_PER_DAY}
            max={MAX_MINUTES_PER_DAY}
            value={minutesInput}
            onChange={(e) => {
              setMinutesInput(e.target.value);
              setSaved(false);
            }}
          />
          <span className="text-graphite font-serif text-xs font-normal leading-relaxed">
            This is a <span className="text-ink font-medium">hard maximum</span>
            . Sessions are sized to stay at or under it, never over.{" "}
            {MIN_MINUTES_PER_DAY}-{MAX_MINUTES_PER_DAY} min (up to 24 hours).
          </span>
        </label>
        <label className="flex flex-col gap-2 font-serif text-sm font-medium">
          <span className="eyebrow !text-[0.65rem] !tracking-wider">
            Days per week
          </span>
          <Input
            id="daysPerWeek"
            name="daysPerWeek"
            type="number"
            min={1}
            max={7}
            value={daysInput}
            onChange={(e) => {
              setDaysInput(e.target.value);
              setSaved(false);
            }}
          />
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="eyebrow border-b border-line/80 pb-2 w-full mb-2">
          What do you want from training?
        </legend>
        <div className="flex flex-col gap-2.5">
          {GOAL_OPTIONS.map((g) => (
            <label key={g.kind} className="choice-control">
              <input
                id={`goal-${g.kind}`}
                name="goals"
                value={g.kind}
                type="checkbox"
                checked={goalKinds.has(g.kind)}
                onChange={() => setGoalKinds((s) => toggle(s, g.kind))}
              />
              {g.label}
            </label>
          ))}
          <div className="mt-2 max-w-md">
            <Input
              id="otherGoal"
              name="otherGoal"
              value={otherGoal}
              onChange={(e) => {
                setOtherGoal(e.target.value);
                setSaved(false);
              }}
              placeholder="Something else (optional)"
              aria-label="Other goal"
              maxLength={120}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="eyebrow border-b border-line/80 pb-2 w-full mb-2">
          Which formats do you play?{" "}
          <span className="text-clay normal-case tracking-normal font-normal">
            required
          </span>
        </legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {CHESS_FORMATS.map((f) => (
            <label key={f} className="choice-control capitalize">
              <input
                id={`format-${f}`}
                name="formats"
                value={f}
                type="checkbox"
                checked={formats.has(f)}
                onChange={() => setFormats((s) => toggle(s, f))}
              />
              {f}
            </label>
          ))}
        </div>
        <label className="choice-control mt-2">
          <input
            id="preferredVariety"
            name="preferredVariety"
            type="checkbox"
            checked={preferredVariety}
            onChange={(e) => {
              setVariety(e.target.checked);
              setSaved(false);
            }}
          />
          I like variety in my daily sessions
        </label>

        {/* M14: the play medium drives the 2D/3D modality + over-the-board recommendations
            and the board interface restrictions (Seam 4 §4.4). */}
        <div className="mt-3 flex flex-col gap-2">
          <span className="eyebrow !text-[0.65rem] !tracking-wider">
            Where do you mostly play?
          </span>
          <div className="flex flex-col gap-2">
            {TARGET_FOCUSES.map((tf) => (
              <label key={tf} className="choice-control">
                <input
                  id={`targetFocus-${tf}`}
                  type="radio"
                  name="targetFocus"
                  value={tf}
                  checked={targetFocus === tf}
                  onChange={() => {
                    setTargetFocus(tf);
                    setSaved(false);
                  }}
                />
                {TARGET_FOCUS_LABELS[tf]}
              </label>
            ))}
          </div>
          <p className="text-graphite font-serif text-xs leading-relaxed">
            Over-the-board players get physical-board and tournament-simulation
            guidance, and a stricter board (no arrows or hover).
          </p>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="eyebrow border-b border-line/80 pb-2 w-full mb-2">
          Where do you prefer to play?
        </legend>
        <p className="text-graphite font-serif text-sm leading-relaxed -mt-1 mb-1">
          We&apos;ll send you straight here when today&apos;s plan says to play
          a game: one click, less friction.
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {(["lichess", "chesscom"] as const).map((p) => (
            <label key={p} className="choice-control">
              <input
                id={`primaryPlatform-${p}`}
                type="radio"
                name="primaryPlatform"
                value={p}
                checked={effectivePrimary === p}
                onChange={() => {
                  setPrimaryPlatform(p);
                  setSaved(false);
                }}
              />
              {platformLabel(p)}
              {connectedPlatforms.includes(p) && (
                <span className="text-evergreen font-mono text-[0.65rem] uppercase tracking-wider">
                  connected
                </span>
              )}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="eyebrow border-b border-line/80 pb-2 w-full mb-2">
          What do you already own?
        </legend>
        <p className="text-graphite font-serif text-sm leading-relaxed -mt-1 mb-1">
          Books, courses, memberships or trainers you have. We&apos;ll prefer
          what you can already use and avoid sending you to buy things.
        </p>
        {ownedResources.length > 0 && (
          <ul className="flex flex-col gap-2">
            {ownedResources.map((r, i) => (
              <li
                key={`${r.kind}-${r.label}-${i}`}
                className="bg-paper/40 flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2"
              >
                <span className="font-serif text-sm text-ink">
                  <span className="text-graphite font-mono text-[0.7rem] uppercase tracking-wider mr-2">
                    {RESOURCE_KIND_LABELS[r.kind]}
                  </span>
                  {r.label}
                </span>
                <Button
                  type="button"
                  onClick={() => removeResource(i)}
                  aria-label={`Remove ${r.label}`}
                  variant="ghost"
                  size="sm"
                  className="-mr-2 shrink-0 text-clay hover:bg-clay/[0.06] hover:text-clay"
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            id="newResourceKind"
            name="newResourceKind"
            value={newResourceKind}
            onChange={(e) =>
              handleResourceKindChange(e.target.value as OwnedResource["kind"])
            }
            aria-label="Resource type"
            className="sm:w-40"
          >
            {OWNED_RESOURCE_KINDS.map((k) => (
              <option key={k} value={k}>
                {RESOURCE_KIND_LABELS[k]}
              </option>
            ))}
          </Select>
          {newResourceKind === "book" ? (
            <Select
              id="newResourceExternalRef"
              name="newResourceExternalRef"
              value={newResourceExternalRef || ""}
              onChange={(e) => {
                const bookId = e.target.value;
                setNewResourceExternalRef(bookId || undefined);
                const book = recommendedBooks.find((b) => b.id === bookId);
                setNewResourceLabel(book ? book.title : "");
                setSaved(false);
              }}
              aria-label="Select recommended book"
              className="flex-1"
              disabled={libraryQuery.isLoading || availableBooks.length === 0}
            >
              {libraryQuery.isLoading ? (
                <option value="">Loading recommended books...</option>
              ) : availableBooks.length === 0 ? (
                <option value="">
                  All recommended books at your level added
                </option>
              ) : (
                <>
                  <option value="">Select a recommended book...</option>
                  {availableBooks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} (by {b.author})
                    </option>
                  ))}
                </>
              )}
            </Select>
          ) : (
            <Input
              id="newResourceLabel"
              name="newResourceLabel"
              value={newResourceLabel}
              onChange={(e) => {
                setNewResourceLabel(e.target.value);
                setSaved(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addResource();
                }
              }}
              placeholder={
                newResourceKind === "course"
                  ? "e.g. Chess Steps Level 1"
                  : newResourceKind === "membership"
                    ? "e.g. Chess.com Diamond"
                    : newResourceKind === "trainer"
                      ? "e.g. Aimchess"
                      : "e.g. Chessable"
              }
              aria-label="Resource name"
              maxLength={160}
              className="flex-1"
            />
          )}
          <Button
            type="button"
            variant="outline"
            onClick={addResource}
            disabled={!newResourceLabel.trim()}
          >
            Add
          </Button>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="eyebrow border-b border-line/80 pb-2 w-full mb-2">
          How do you like to train?
        </legend>
        <div className="flex flex-col gap-2.5">
          {DEPTH_VS_BREADTH.map((d) => (
            <label key={d} className="choice-control">
              <input
                id={`depthVsBreadth-${d}`}
                type="radio"
                name="depthVsBreadth"
                value={d}
                checked={depthVsBreadth === d}
                onChange={() => {
                  setDepth(d);
                  setSaved(false);
                }}
              />
              {DEPTH_LABELS[d]}
            </label>
          ))}
        </div>
        <label className="choice-control mt-1">
          <input
            id="interleave"
            name="interleave"
            type="checkbox"
            checked={interleave}
            onChange={(e) => {
              setInterleave(e.target.checked);
              setSaved(false);
            }}
          />
          Mix different topics within a session (interleaving)
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="eyebrow border-b border-line/80 pb-2 w-full mb-1">
          Your if-then plan
        </legend>
        <MethodologyRationaleCard rationale={ifThenRationale} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2">
            <span className="font-serif text-sm text-graphite shrink-0">
              After
            </span>
            <Input
              id="ifThenCue"
              name="ifThenCue"
              value={cue}
              onChange={(e) => {
                setCue(e.target.value);
                setSaved(false);
              }}
              placeholder="my morning coffee"
              aria-label="If-then cue"
              maxLength={160}
              className="flex-1"
            />
          </div>
          <div className="flex flex-1 items-center gap-2">
            <span className="font-serif text-sm text-graphite shrink-0">
              , I will
            </span>
            <Input
              id="ifThenPlan"
              name="ifThenPlan"
              value={plan}
              onChange={(e) => {
                setPlan(e.target.value);
                setSaved(false);
              }}
              placeholder="open today's session"
              aria-label="If-then plan"
              maxLength={160}
              className="flex-1"
            />
          </div>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4 border-t border-line/80 pt-6 mt-4">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save constraints"}
        </Button>
        {isDirty && !saved && (
          <span className="rounded-sm border border-amber/40 bg-amber/10 px-2.5 py-1 font-mono text-[0.68rem] font-semibold uppercase text-amber">
            Unsaved changes
          </span>
        )}
        {saved && (
          <>
            <StatusMessage tone="success" className="py-2">
              Saved. Your next session will use these settings.
            </StatusMessage>
            <Link
              href={continueHref}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {continueLabel}
            </Link>
          </>
        )}
        {error && <StatusMessage tone="error">{error}</StatusMessage>}
      </div>
    </form>
  );
}
