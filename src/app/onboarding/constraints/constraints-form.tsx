"use client";

import { useState } from "react";
import Link from "next/link";

import { trpc } from "@/lib/trpc/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CHESS_FORMATS,
  EMPTY_CONSTRAINTS,
  type ConstraintsInput,
  type Goal,
} from "@/lib/constraints";

// Goal kinds offered as checkboxes (label is UI copy; the schema stores { kind, label }).
// These are aspirations/constraints — never a skill self-rating (Seam 2 boundary).
const GOAL_OPTIONS: ReadonlyArray<{ kind: Goal["kind"]; label: string }> = [
  { kind: "rating", label: "Raise my rating" },
  { kind: "tactics", label: "Sharpen tactics" },
  { kind: "openings", label: "Improve my openings" },
  { kind: "endgames", label: "Improve my endgames" },
  { kind: "consistency", label: "Train consistently" },
  { kind: "fun", label: "Enjoy the game more" },
];

export function ConstraintsForm() {
  const current = trpc.constraints.getCurrent.useQuery();
  if (current.isLoading) {
    return <p className="text-graphite font-mono text-sm">Loading…</p>;
  }
  // Key on the loaded row so the form initialises its state from saved values once.
  return (
    <Form
      key={current.data?.id ?? "new"}
      initial={current.data ?? EMPTY_CONSTRAINTS}
    />
  );
}

function Form({ initial }: { initial: ConstraintsInput }) {
  const utils = trpc.useUtils();
  const save = trpc.constraints.save.useMutation({
    onSuccess: () => {
      setSaved(true);
      void utils.constraints.getCurrent.invalidate();
    },
    onError: (e) => setError(e.message),
  });

  const [minutesPerDay, setMinutes] = useState(initial.minutesPerDay);
  const [daysPerWeek, setDays] = useState(initial.daysPerWeek);
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
  const [cue, setCue] = useState(initial.ifThenPlan?.cue ?? "");
  const [plan, setPlan] = useState(initial.ifThenPlan?.plan ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = <T,>(set: Set<T>, value: T): Set<T> => {
    const nextSet = new Set(set);
    if (nextSet.has(value)) nextSet.delete(value);
    else nextSet.add(value);
    return nextSet;
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    setError(null);
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
      minutesPerDay,
      daysPerWeek,
      goals,
      ownedResources: initial.ownedResources,
      formatPrefs: {
        formats: CHESS_FORMATS.filter((f) => formats.has(f)),
        preferredVariety,
      },
      ifThenPlan: cueT && planT ? { cue: cueT, plan: planT } : null,
    });
  };

  return (
    <form className="flex flex-col gap-10 settle" onSubmit={onSubmit}>
      <fieldset className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <label className="flex flex-col gap-2 font-serif text-sm font-medium">
          <span className="eyebrow !text-[0.65rem] !tracking-wider">
            Minutes per day
          </span>
          <Input
            type="number"
            min={5}
            max={600}
            value={minutesPerDay}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-2 font-serif text-sm font-medium">
          <span className="eyebrow !text-[0.65rem] !tracking-wider">
            Days per week
          </span>
          <Input
            type="number"
            min={1}
            max={7}
            value={daysPerWeek}
            onChange={(e) => setDays(Number(e.target.value))}
          />
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="eyebrow border-b border-line/80 pb-2 w-full mb-2">
          What do you want from training?
        </legend>
        <div className="flex flex-col gap-2.5">
          {GOAL_OPTIONS.map((g) => (
            <label
              key={g.kind}
              className="flex items-center gap-3 font-serif text-sm text-ink cursor-pointer"
            >
              <input
                type="checkbox"
                checked={goalKinds.has(g.kind)}
                onChange={() => setGoalKinds((s) => toggle(s, g.kind))}
                className="rounded border-input text-evergreen focus:ring-evergreen h-4 w-4 bg-paper-raised"
              />
              {g.label}
            </label>
          ))}
          <div className="mt-2 max-w-md">
            <Input
              value={otherGoal}
              onChange={(e) => setOtherGoal(e.target.value)}
              placeholder="Something else (optional)"
              aria-label="Other goal"
              maxLength={120}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="eyebrow border-b border-line/80 pb-2 w-full mb-2">
          Which formats do you play?
        </legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {CHESS_FORMATS.map((f) => (
            <label
              key={f}
              className="flex items-center gap-3 font-serif text-sm text-ink capitalize cursor-pointer"
            >
              <input
                type="checkbox"
                checked={formats.has(f)}
                onChange={() => setFormats((s) => toggle(s, f))}
                className="rounded border-input text-evergreen focus:ring-evergreen h-4 w-4 bg-paper-raised"
              />
              {f}
            </label>
          ))}
        </div>
        <label className="mt-2 flex items-center gap-3 font-serif text-sm text-ink cursor-pointer">
          <input
            type="checkbox"
            checked={preferredVariety}
            onChange={(e) => setVariety(e.target.checked)}
            className="rounded border-input text-evergreen focus:ring-evergreen h-4 w-4 bg-paper-raised"
          />
          I like variety in my daily sessions
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="eyebrow border-b border-line/80 pb-2 w-full mb-1">
          Your if-then plan
        </legend>
        <p className="text-graphite font-serif text-sm leading-relaxed mb-2">
          Anchoring training to an existing daily habit roughly doubles
          follow-through (Gollwitzer &amp; Sheeran 2006). Optional, but it
          helps.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className="font-serif text-sm text-graphite shrink-0">
            After
          </span>
          <Input
            value={cue}
            onChange={(e) => setCue(e.target.value)}
            placeholder="my morning coffee"
            aria-label="If-then cue"
            maxLength={160}
            className="flex-1"
          />
          <span className="font-serif text-sm text-graphite shrink-0">
            , I will
          </span>
          <Input
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            placeholder="open today's session"
            aria-label="If-then plan"
            maxLength={160}
            className="flex-1"
          />
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4 border-t border-line/80 pt-6 mt-4">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save constraints"}
        </Button>
        {saved && (
          <>
            <span
              className="text-sm font-mono font-medium text-evergreen"
              role="status"
            >
              Saved ✓
            </span>
            <Link
              href="/onboarding/reveal"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Continue →
            </Link>
          </>
        )}
        {error && (
          <span className="text-clay font-mono text-sm" role="alert">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
