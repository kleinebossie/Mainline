"use client";

import { useState } from "react";
import Link from "next/link";

import { trpc } from "@/lib/trpc/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CHESS_FORMATS,
  DEPTH_VS_BREADTH,
  EMPTY_CONSTRAINTS,
  OWNED_RESOURCE_KINDS,
  type ConstraintsInput,
  type Goal,
  type OwnedResource,
  type SessionStyle,
} from "@/lib/constraints";

// Labels for the owned-resource kinds (UI copy; the schema stores the kind enum).
const RESOURCE_KIND_LABELS: Record<OwnedResource["kind"], string> = {
  book: "Book",
  course: "Course",
  membership: "Membership",
  trainer: "Trainer / app",
  other: "Other",
};

const DEPTH_LABELS: Record<SessionStyle["depthVsBreadth"], string> = {
  depth: "Go deep — fewer topics, harder",
  balanced: "Balanced",
  breadth: "Go broad — more variety",
};

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

// Reused in onboarding (continue → reveal) and in Settings (continue → today). The
// continuation is the only thing that differs between the two contexts.
export function ConstraintsForm({
  continueHref = "/onboarding/reveal",
  continueLabel = "Continue →",
}: {
  continueHref?: string;
  continueLabel?: string;
} = {}) {
  const current = trpc.constraints.getCurrent.useQuery();
  if (current.isLoading) {
    return <p className="text-graphite font-mono text-sm">Loading…</p>;
  }
  // Key on the loaded row so the form initialises its state from saved values once.
  return (
    <Form
      key={current.data?.id ?? "new"}
      initial={current.data ?? EMPTY_CONSTRAINTS}
      continueHref={continueHref}
      continueLabel={continueLabel}
    />
  );
}

function Form({
  initial,
  continueHref,
  continueLabel,
}: {
  initial: ConstraintsInput;
  continueHref: string;
  continueLabel: string;
}) {
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
  const [ownedResources, setOwnedResources] = useState<OwnedResource[]>(
    initial.ownedResources,
  );
  const [newResourceKind, setNewResourceKind] =
    useState<OwnedResource["kind"]>("book");
  const [newResourceLabel, setNewResourceLabel] = useState("");
  const [depthVsBreadth, setDepth] = useState<SessionStyle["depthVsBreadth"]>(
    initial.sessionStyle.depthVsBreadth,
  );
  const [interleave, setInterleave] = useState(initial.sessionStyle.interleave);
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

  const addResource = () => {
    const label = newResourceLabel.trim();
    if (!label || ownedResources.length >= 100) return;
    setOwnedResources((rs) => [...rs, { kind: newResourceKind, label }]);
    setNewResourceLabel("");
  };
  const removeResource = (index: number) =>
    setOwnedResources((rs) => rs.filter((_, i) => i !== index));

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
      ownedResources,
      formatPrefs: {
        formats: CHESS_FORMATS.filter((f) => formats.has(f)),
        preferredVariety,
      },
      sessionStyle: { depthVsBreadth, interleave },
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
                <button
                  type="button"
                  onClick={() => removeResource(i)}
                  aria-label={`Remove ${r.label}`}
                  className="text-graphite hover:text-clay font-mono text-xs transition-colors"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={newResourceKind}
            onChange={(e) =>
              setNewResourceKind(e.target.value as OwnedResource["kind"])
            }
            aria-label="Resource type"
            className="border-input bg-paper-raised text-ink h-10 rounded-md border px-3 font-mono text-sm focus:ring-evergreen focus:outline-none focus:ring-2"
          >
            {OWNED_RESOURCE_KINDS.map((k) => (
              <option key={k} value={k}>
                {RESOURCE_KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <Input
            value={newResourceLabel}
            onChange={(e) => setNewResourceLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addResource();
              }
            }}
            placeholder="e.g. Dvoretsky's Endgame Manual"
            aria-label="Resource name"
            maxLength={160}
            className="flex-1"
          />
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
            <label
              key={d}
              className="flex items-center gap-3 font-serif text-sm text-ink cursor-pointer"
            >
              <input
                type="radio"
                name="depthVsBreadth"
                checked={depthVsBreadth === d}
                onChange={() => setDepth(d)}
                className="border-input text-evergreen focus:ring-evergreen h-4 w-4 bg-paper-raised"
              />
              {DEPTH_LABELS[d]}
            </label>
          ))}
        </div>
        <label className="mt-1 flex items-center gap-3 font-serif text-sm text-ink cursor-pointer">
          <input
            type="checkbox"
            checked={interleave}
            onChange={(e) => setInterleave(e.target.checked)}
            className="rounded border-input text-evergreen focus:ring-evergreen h-4 w-4 bg-paper-raised"
          />
          Mix different topics within a session (interleaving)
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
              href={continueHref}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {continueLabel}
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
