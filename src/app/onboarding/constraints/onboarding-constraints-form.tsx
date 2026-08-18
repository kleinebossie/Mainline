"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Monitor, Sliders, Trophy, Zap } from "lucide-react";

import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusMessage } from "@/components/ui/status-message";
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
import {
  getGuestSession,
  saveGuestConstraints,
  generateGuestProgram,
  type GuestConstraints,
} from "@/lib/guest-session";
import { trackFunnelEvent } from "@/lib/telemetry";

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
  continueHref = "/connections",
  continueLabel = "Continue setup →",
}: {
  continueHref?: string;
  continueLabel?: string;
}) {
  const [guestConstraints, setGuestConstraints] = useState<GuestConstraints | null>(() =>
    typeof window !== "undefined" ? getGuestSession().constraints : null,
  );
  const [hasGuest, setHasGuest] = useState(() =>
    typeof window !== "undefined"
      ? Boolean(getGuestSession().baseline || getGuestSession().constraints)
      : false,
  );

  useEffect(() => {
    const session = getGuestSession();
    setGuestConstraints(session.constraints);
    setHasGuest(Boolean(session.baseline || session.constraints));
  }, []);

  const current = trpc.constraints.getCurrent.useQuery(undefined, {
    enabled: !hasGuest,
    retry: false,
  });

  if (current.isLoading && !guestConstraints && !current.data) {
    return <StatusMessage tone="loading">Loading your plan…</StatusMessage>;
  }

  const initial =
    current.data ??
    (guestConstraints
      ? {
          ...EMPTY_CONSTRAINTS,
          minutesPerDay: guestConstraints.minutesPerDay,
          daysPerWeek: guestConstraints.daysPerWeek,
          formatPrefs: guestConstraints.formatPrefs,
        }
      : EMPTY_CONSTRAINTS);

  const isGuestMode = hasGuest || Boolean(current.error);

  return (
    <StreamlinedForm
      initial={initial}
      isGuestMode={isGuestMode}
      continueHref={continueHref}
      continueLabel={continueLabel}
    />
  );
}

function StreamlinedForm({
  initial,
  isGuestMode = false,
  continueHref,
  continueLabel,
}: {
  initial: ConstraintsInput;
  isGuestMode?: boolean;
  continueHref: string;
  continueLabel?: string;
}) {
  const router = useRouter();
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextDestination, setNextDestination] = useState<string>(continueHref);

  const save = trpc.constraints.save.useMutation({
    onSuccess: () => {
      setSubmitting(false);
      void utils.constraints.getCurrent.invalidate();
      router.push(nextDestination || continueHref);
    },
    onError: (e) => {
      setSubmitting(false);
      if (isGuestMode) {
        router.push(nextDestination || continueHref);
        return;
      }
      setError(
        errorMessage(
          e,
          "Your preferences were not saved. Check the form and try again.",
        ),
      );
    },
  });

  const parsedMinutes = Number.parseInt(minutesInput.trim(), 10);
  const currentMinutes = Number.isNaN(parsedMinutes) ? 0 : parsedMinutes;

  const handleMinutesChange = (value: string) => {
    setMinutesInput(value);
  };

  const handlePresetClick = (preset: number) => {
    setMinutesInput(String(preset));
  };

  const handleFormatChange = (format: "blitz" | "rapid" | "classical") => {
    setSelectedFormat(format);
  };

  const handleBulletChange = (checked: boolean) => {
    setIncludeBullet(checked);
  };

  const handleFocusChange = (focus: TargetFocus) => {
    setTargetFocus(focus);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const parsedMinutes = Number.parseInt(minutesInput, 10);
    if (
      Number.isNaN(parsedMinutes) ||
      parsedMinutes < MIN_MINUTES_PER_DAY ||
      parsedMinutes > MAX_MINUTES_PER_DAY
    ) {
      setSubmitting(false);
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

    const destination = nextDestination || continueHref;

    saveGuestConstraints({
      minutesPerDay: parsedMinutes,
      daysPerWeek: initial.daysPerWeek || 5,
      goals: initial.goals.map((g) => g.kind),
      ownedResources: initial.ownedResources,
      formatPrefs: {
        formats: mergedFormats,
        preferredVariety: initial.formatPrefs.preferredVariety,
        targetFocus,
      },
    });

    if (destination === "/today") {
      generateGuestProgram();
    }

    trackFunnelEvent("onboarding_completed", {
      minutesPerDay: parsedMinutes,
      daysPerWeek: initial.daysPerWeek || 5,
      primaryFormat: selectedFormat,
      isGuest: isGuestMode,
    });

    save.mutate(
      {
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
      },
      {
        onSuccess: () => {
          setSubmitting(false);
          void utils.constraints.getCurrent.invalidate();
          router.push(destination);
        },
        onError: (e) => {
          setSubmitting(false);
          if (isGuestMode) {
            router.push(destination);
            return;
          }
          setError(
            errorMessage(
              e,
              "Your preferences were not saved. Check the form and try again.",
            ),
          );
        },
      },
    );
  };

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

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-t border-line/80 pt-6 mt-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Button
            type="submit"
            size="lg"
            disabled={submitting || save.isPending}
            onClick={() => setNextDestination("/today")}
            className="w-full sm:w-auto"
          >
            {submitting || (save.isPending && nextDestination === "/today")
              ? "Saving & building session…"
              : "Build my first session →"}
          </Button>
          <Button
            type="submit"
            variant="outline"
            size="lg"
            disabled={submitting || save.isPending}
            onClick={() =>
              setNextDestination(
                continueHref === "/today" ? "/connections" : continueHref,
              )
            }
            className="w-full sm:w-auto"
          >
            {continueLabel ?? "Continue setup →"}
          </Button>
        </div>
        {error && <StatusMessage tone="error">{error}</StatusMessage>}
      </div>
    </form>
  );
}
