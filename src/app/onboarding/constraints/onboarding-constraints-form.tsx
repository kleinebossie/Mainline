"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Clock, Monitor, Sliders, Trophy, Zap } from "lucide-react";

import { trpc } from "@/lib/trpc/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusMessage } from "@/components/ui/status-message";
import { ErrorNotice } from "@/components/ui/error-notice";
import {
  MAX_MINUTES_PER_DAY,
  MIN_MINUTES_PER_DAY,
} from "@/lib/constraint-limits";
import {
  CHESS_FORMATS,
  EMPTY_CONSTRAINTS,
  type ConstraintsInput,
  type TargetFocus,
} from "@/lib/constraints";
import { errorMessage } from "@/lib/error-presentation";
import { cn } from "@/lib/utils";

const TIME_PRESETS = [15, 20, 30, 45, 60] as const;

interface FormatOption {
  readonly id: "blitz" | "rapid" | "classical";
  readonly title: string;
  readonly timeRange: string;
  readonly description: string;
  readonly icon: typeof Zap;
  readonly badge?: string;
}

const FORMAT_OPTIONS: readonly FormatOption[] = [
  {
    id: "blitz",
    title: "Blitz",
    timeRange: "3 to 5 min",
    description:
      "Fast pattern recognition, speed tactics, and sharp instincts.",
    icon: Zap,
  },
  {
    id: "rapid",
    title: "Rapid",
    timeRange: "10 to 15 min",
    description:
      "Deep calculation, structured strategy, and balanced clock play.",
    icon: Trophy,
    badge: "Recommended",
  },
  {
    id: "classical",
    title: "Classical",
    timeRange: "30+ min",
    description:
      "Complex calculation, endgame precision, and tournament stamina.",
    icon: Clock,
  },
];

interface ModalityOption {
  readonly id: TargetFocus;
  readonly title: string;
  readonly description: string;
  readonly detail: string;
}

const MODALITY_OPTIONS: readonly ModalityOption[] = [
  {
    id: "online",
    title: "Screen only",
    description: "2D digital board and fast online solving.",
    detail: "Standard digital arrows, hover states, and click moves.",
  },
  {
    id: "otb",
    title: "Physical board",
    description: "Real chess set and tournament simulation.",
    detail:
      "Hides visual arrows and hover cues to build real-board visualization.",
  },
  {
    id: "hybrid",
    title: "Both",
    description: "Flexible mix of screen and over-the-board play.",
    detail:
      "Combines digital training drills with physical board recommendations.",
  },
];

export function OnboardingConstraintsForm({
  continueHref = "/onboarding/reveal",
  continueLabel = "Continue →",
}: {
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

  return (
    <StreamlinedForm
      initial={current.data ?? EMPTY_CONSTRAINTS}
      continueHref={continueHref}
      continueLabel={continueLabel}
    />
  );
}

function StreamlinedForm({
  initial,
  continueHref,
  continueLabel,
}: {
  initial: ConstraintsInput;
  continueHref: string;
  continueLabel: string;
}) {
  const utils = trpc.useUtils();
  const [minutesInput, setMinutesInput] = useState<string>(
    String(initial.minutesPerDay),
  );
  const [selectedFormat, setSelectedFormat] = useState<
    "blitz" | "rapid" | "classical"
  >(() => {
    const first = initial.formatPrefs.formats.find(
      (f): f is "blitz" | "rapid" | "classical" =>
        f === "blitz" || f === "rapid" || f === "classical",
    );
    return first ?? "rapid";
  });
  const [includeBullet, setIncludeBullet] = useState(() =>
    initial.formatPrefs.formats.includes("bullet"),
  );
  const [targetFocus, setTargetFocus] = useState<TargetFocus>(
    initial.formatPrefs.targetFocus,
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const parsedMinutes = parseInt(minutesInput.trim(), 10);
  const currentMinutes = Number.isNaN(parsedMinutes) ? 0 : parsedMinutes;

  const handleMinutesChange = (value: string) => {
    setMinutesInput(value);
    setSaved(false);
  };

  const handlePresetClick = (preset: number) => {
    setMinutesInput(String(preset));
    setSaved(false);
  };

  const handleFormatChange = (format: "blitz" | "rapid" | "classical") => {
    setSelectedFormat(format);
    setSaved(false);
  };

  const handleBulletChange = (checked: boolean) => {
    setIncludeBullet(checked);
    setSaved(false);
  };

  const handleFocusChange = (focus: TargetFocus) => {
    setTargetFocus(focus);
    setSaved(false);
  };

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
        `Please enter a daily time budget between ${MIN_MINUTES_PER_DAY} and ${MAX_MINUTES_PER_DAY} minutes.`,
      );
      return;
    }

    const chosenFormats: ("bullet" | "blitz" | "rapid" | "classical")[] = [];
    if (includeBullet) chosenFormats.push("bullet");
    chosenFormats.push(selectedFormat);

    // Keep any other format the user previously saved if they had custom multi-selection
    const otherSavedFormats = initial.formatPrefs.formats.filter(
      (f) =>
        f !== "bullet" && f !== "blitz" && f !== "rapid" && f !== "classical",
    );

    const mergedFormats = Array.from(
      new Set([...chosenFormats, ...otherSavedFormats]),
    ).filter((f) => CHESS_FORMATS.includes(f));

    save.mutate({
      minutesPerDay: parsedMinutes,
      daysPerWeek: initial.daysPerWeek || 5,
      goals: initial.goals,
      ownedResources: initial.ownedResources,
      formatPrefs: {
        formats: mergedFormats,
        preferredVariety: initial.formatPrefs.preferredVariety,
        targetFocus,
      },
      sessionStyle: initial.sessionStyle,
      ifThenPlan: initial.ifThenPlan,
    });
  };

  const initialPrimaryFormat =
    initial.formatPrefs.formats.find(
      (f): f is "blitz" | "rapid" | "classical" =>
        f === "blitz" || f === "rapid" || f === "classical",
    ) ?? "rapid";
  const initialBullet = initial.formatPrefs.formats.includes("bullet");

  const isDirty =
    currentMinutes !== initial.minutesPerDay ||
    selectedFormat !== initialPrimaryFormat ||
    includeBullet !== initialBullet ||
    targetFocus !== initial.formatPrefs.targetFocus;

  return (
    <form className="flex flex-col gap-10 settle" onSubmit={onSubmit}>
      {/* 1. Daily Time Budget */}
      <fieldset className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="eyebrow !text-[0.65rem] !tracking-wider">
            01 / Daily time budget
          </span>
          <legend className="font-serif text-lg font-semibold text-ink">
            How much time can you train each day?
          </legend>
          <p className="text-graphite font-serif text-sm leading-relaxed">
            This is a <span className="text-ink font-medium">hard limit</span>.
            Daily sessions are sized to stay at or below this budget.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {TIME_PRESETS.map((preset) => {
            const isSelected = currentMinutes === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => handlePresetClick(preset)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-3.5 py-2 font-mono text-xs font-medium transition-all",
                  isSelected
                    ? "border-evergreen bg-evergreen text-primary-foreground shadow-sm"
                    : "border-line bg-paper-raised text-ink hover:border-ink/20 hover:bg-ink/[0.03]",
                )}
              >
                <Clock className="h-3.5 w-3.5" />
                {preset} min
                {preset === 20 && (
                  <span
                    className={cn(
                      "ml-1 font-mono text-[0.6rem] uppercase tracking-wider",
                      isSelected
                        ? "text-primary-foreground/90"
                        : "text-graphite",
                    )}
                  >
                    (Default)
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 pt-1 max-w-xs">
          <label
            htmlFor="minutesPerDay"
            className="text-graphite font-serif text-xs shrink-0"
          >
            Custom minutes:
          </label>
          <Input
            id="minutesPerDay"
            name="minutesPerDay"
            type="number"
            min={MIN_MINUTES_PER_DAY}
            max={MAX_MINUTES_PER_DAY}
            value={minutesInput}
            onChange={(e) => handleMinutesChange(e.target.value)}
            className="h-9 w-24 font-mono text-sm"
          />
          <span className="text-graphite font-serif text-xs">min / day</span>
        </div>
      </fieldset>

      {/* 2. Primary Format */}
      <fieldset className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="eyebrow !text-[0.65rem] !tracking-wider">
            02 / Primary format
          </span>
          <legend className="font-serif text-lg font-semibold text-ink">
            What is your main game format?
          </legend>
          <p className="text-graphite font-serif text-sm leading-relaxed">
            Mainline tunes your calculation depth and tactical drills to this
            pace.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {FORMAT_OPTIONS.map((opt) => {
            const isSelected = selectedFormat === opt.id;
            const Icon = opt.icon;
            return (
              <label
                key={opt.id}
                htmlFor={`format-${opt.id}`}
                className={cn(
                  "relative flex cursor-pointer flex-col justify-between rounded-lg border p-4 transition-all shadow-sheet",
                  isSelected
                    ? "border-evergreen bg-evergreen/[0.05] ring-2 ring-evergreen/40"
                    : "border-line bg-card hover:border-ink/20 hover:bg-paper-raised",
                )}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          isSelected ? "text-evergreen" : "text-graphite",
                        )}
                      />
                      <span className="font-serif text-base font-semibold text-ink">
                        {opt.title}
                      </span>
                    </div>
                    {opt.badge && (
                      <span className="rounded bg-evergreen/10 px-1.5 py-0.5 font-mono text-[0.6rem] font-medium text-evergreen uppercase tracking-wider">
                        {opt.badge}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs text-graphite">
                    {opt.timeRange}
                  </span>
                  <p className="text-graphite font-serif text-xs leading-relaxed pt-1">
                    {opt.description}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
                  <span className="font-serif text-xs text-graphite">
                    {isSelected ? "Selected" : "Select"}
                  </span>
                  <input
                    id={`format-${opt.id}`}
                    type="radio"
                    name="primaryFormat"
                    value={opt.id}
                    checked={isSelected}
                    onChange={() => handleFormatChange(opt.id)}
                    className="border-input accent-evergreen h-4 w-4"
                  />
                </div>
              </label>
            );
          })}
        </div>

        <div className="pt-1">
          <label className="choice-control inline-flex items-center text-xs">
            <input
              id="includeBullet"
              name="includeBullet"
              type="checkbox"
              checked={includeBullet}
              onChange={(e) => handleBulletChange(e.target.checked)}
            />
            <span className="text-graphite font-serif">
              I also play <span className="text-ink font-medium">Bullet</span>{" "}
              (1 to 2 min games)
            </span>
          </label>
        </div>
      </fieldset>

      {/* 3. Screen vs Physical Board */}
      <fieldset className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="eyebrow !text-[0.65rem] !tracking-wider">
            03 / Board modality
          </span>
          <legend className="font-serif text-lg font-semibold text-ink">
            Where do you mostly play?
          </legend>
          <p className="text-graphite font-serif text-sm leading-relaxed">
            Choose whether your practice should focus on screen or real physical
            chess sets.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {MODALITY_OPTIONS.map((opt) => {
            const isSelected = targetFocus === opt.id;
            return (
              <label
                key={opt.id}
                htmlFor={`targetFocus-${opt.id}`}
                className={cn(
                  "relative flex cursor-pointer flex-col justify-between rounded-lg border p-4 transition-all shadow-sheet",
                  isSelected
                    ? "border-evergreen bg-evergreen/[0.05] ring-2 ring-evergreen/40"
                    : "border-line bg-card hover:border-ink/20 hover:bg-paper-raised",
                )}
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <Monitor
                      className={cn(
                        "h-4 w-4",
                        isSelected ? "text-evergreen" : "text-graphite",
                      )}
                    />
                    <span className="font-serif text-base font-semibold text-ink">
                      {opt.title}
                    </span>
                  </div>
                  <p className="font-serif text-xs font-medium text-ink/90 pt-0.5">
                    {opt.description}
                  </p>
                  <p className="text-graphite font-serif text-xs leading-relaxed pt-1">
                    {opt.detail}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
                  <span className="font-serif text-xs text-graphite">
                    {isSelected ? "Selected" : "Select"}
                  </span>
                  <input
                    id={`targetFocus-${opt.id}`}
                    type="radio"
                    name="targetFocus"
                    value={opt.id}
                    checked={isSelected}
                    onChange={() => handleFocusChange(opt.id)}
                    className="border-input accent-evergreen h-4 w-4"
                  />
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Settings Signpost Card */}
      <div className="bg-paper-raised/80 rounded-lg border border-line/80 p-4 shadow-sheet">
        <div className="flex items-start gap-3">
          <div className="rounded-md border border-line bg-paper p-2 text-graphite shrink-0">
            <Sliders className="h-4 w-4" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <p className="font-serif text-sm font-semibold text-ink">
                Advanced settings live in Settings
              </p>
              <span className="rounded bg-line/60 px-1.5 py-0.5 font-mono text-[0.6rem] font-medium uppercase tracking-wider text-graphite">
                Customizable later
              </span>
            </div>
            <p className="text-graphite font-serif text-xs leading-relaxed">
              You can add your owned chess books, customize habit cues, and
              adjust topic mixing in{" "}
              <span className="text-ink font-medium">Settings</span> at any
              time.
            </p>
          </div>
        </div>
      </div>

      {/* Save Success Banner */}
      {saved && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-lg border border-evergreen/40 bg-evergreen/[0.08] p-4 text-ink shadow-sheet">
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-evergreen text-primary-foreground">
              <Check className="h-4 w-4 stroke-[3]" />
            </span>
            <div className="flex flex-col">
              <p className="font-serif text-sm font-semibold text-evergreen">
                Preferences saved
              </p>
              <p className="font-serif text-xs text-graphite">
                Saved. Your daily program will use these settings.
              </p>
            </div>
          </div>
          <Link
            href={continueHref}
            className={cn(
              buttonVariants({ variant: "default", size: "sm" }),
              "shrink-0",
            )}
          >
            {continueLabel}
          </Link>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-4 border-t border-line/80 pt-6 mt-2">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending
            ? "Saving…"
            : saved
              ? "Save again"
              : "Save constraints"}
        </Button>
        {isDirty && !saved && (
          <span className="rounded-sm border border-amber/40 bg-amber/10 px-2.5 py-1 font-mono text-[0.68rem] font-semibold uppercase text-amber">
            Unsaved changes
          </span>
        )}
        {error && <StatusMessage tone="error">{error}</StatusMessage>}
      </div>
    </form>
  );
}
