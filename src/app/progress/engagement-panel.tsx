"use client";

import { useState } from "react";

import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// The engagement panel (BUILD.md §9, M8/M9). Surfaces the FORGIVING, capped consistency
// mechanics Seam 9 allows — a week-capped streak, a GitHub-style consistency grid, genuine
// competence recognition (each carrying its evidence grade), and capped, user-configurable
// reminders. No infinite streak, no leaderboard, no fake urgency: the honesty brand applied
// to motivation. All copy + grades come from the methodology; this only renders them.

const EVENT_GLYPH: Record<string, string> = {
  streak_tick: "▰",
  competence_milestone: "✦",
  consistency_grid: "▦",
  recovery_prompt: "↺",
};

function ConsistencyGrid({
  grid,
}: {
  grid: { date: Date; active: boolean }[];
}) {
  return (
    <div
      className="grid grid-flow-col grid-rows-7 gap-[3px]"
      role="img"
      aria-label="Consistency grid — days you trained over the last weeks"
    >
      {grid.map((cell) => (
        <span
          key={cell.date.toISOString()}
          title={`${cell.date.toLocaleDateString()} — ${cell.active ? "trained" : "no activity"}`}
          className={cn(
            "h-3 w-3 rounded-[2px]",
            cell.active ? "bg-evergreen" : "bg-ink/10",
          )}
        />
      ))}
    </div>
  );
}

function ReminderForm({
  initial,
  cap,
}: {
  initial: { enabled: boolean; cadenceCap: number };
  cap: number;
}) {
  const utils = trpc.useUtils();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [cadence, setCadence] = useState(String(initial.cadenceCap));
  const save = trpc.engagement.saveNotificationPref.useMutation({
    onSuccess: (saved) => {
      setEnabled(saved.enabled);
      setCadence(String(saved.cadenceCap));
      void utils.engagement.summary.invalidate();
    },
  });

  return (
    <div className="bg-card flex flex-col gap-3 rounded-md border p-4">
      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(ev) => setEnabled(ev.target.checked)}
          className="accent-evergreen h-4 w-4"
        />
        <span className="font-serif text-sm">Send me gentle reminders</span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-graphite font-mono text-xs">reminders/day</span>
        <Input
          type="number"
          min={0}
          max={cap}
          inputMode="numeric"
          value={cadence}
          disabled={!enabled}
          onChange={(ev) => setCadence(ev.target.value)}
          className="h-8 w-20"
        />
        <span className="text-graphite font-mono text-[0.7rem]">
          capped at {cap}/day — no nagging, ever
        </span>
      </div>
      <Button
        type="button"
        size="sm"
        className="self-start"
        disabled={save.isPending}
        onClick={() =>
          save.mutate({
            channel: enabled ? "email" : "none",
            cadenceCap: Number(cadence) || 0,
            enabled,
          })
        }
      >
        {save.isPending ? "Saving…" : "Save reminders"}
      </Button>
      {save.data && (
        <p className="text-graphite font-mono text-[0.7rem]">
          Saved · {save.data.enabled ? `${save.data.cadenceCap}/day` : "off"}
        </p>
      )}
    </div>
  );
}

export function EngagementPanel() {
  const utils = trpc.useUtils();
  const summary = trpc.engagement.summary.useQuery();
  const markSeen = trpc.engagement.markSeen.useMutation({
    onSuccess: () => void utils.engagement.summary.invalidate(),
  });

  // Initialise the reminder form only once the summary has loaded its persisted prefs.
  const data = summary.data;

  if (summary.isLoading) {
    return (
      <p className="text-graphite font-mono text-sm">Loading consistency…</p>
    );
  }
  if (!data) {
    return <p className="text-graphite text-sm">No consistency data yet.</p>;
  }

  const unseenIds = data.recentEvents
    .filter((e) => !e.seen && e.id)
    .map((e) => e.id as string);

  return (
    <div className="flex flex-col gap-8">
      {/* Capped, forgiving streak — the headline never grows unbounded. */}
      <div className="bg-card rounded-lg border p-5 shadow-sheet">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="eyebrow">Consistency cycle</p>
          <span className="text-graphite font-mono text-xs">
            {data.streak.activeDayCount} active day
            {data.streak.activeDayCount === 1 ? "" : "s"} ·{" "}
            {data.streak.windowDays}-day window
          </span>
        </div>
        <p className="mt-2 font-serif text-2xl font-semibold tracking-tight">
          {data.streak.day > 0 ? (
            <>
              Day {data.streak.day}{" "}
              <span className="text-graphite font-normal">
                of {data.streak.cap}
              </span>
            </>
          ) : (
            <span className="text-graphite">Start a fresh cycle today</span>
          )}
        </p>

        <div className="mt-4">
          <ConsistencyGrid grid={data.grid} />
        </div>

        <p className="text-graphite mt-4 border-l-2 border-evergreen/40 pl-3 font-serif text-sm leading-relaxed">
          {data.gridCaption.text}
        </p>

      </div>

      {/* Genuine recognition — each carries its evidence grade (never hype). */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 border-b border-line/80 pb-3">
          <h3 className="eyebrow">Recognition</h3>
          {unseenIds.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={markSeen.isPending}
              onClick={() => markSeen.mutate({ ids: unseenIds })}
            >
              Mark all read
            </Button>
          )}
        </div>
        {data.recentEvents.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {data.recentEvents.map((e) => (
              <li
                key={e.id ?? `${e.type}-${e.occurredAt?.toISOString()}`}
                className={cn(
                  "bg-card flex flex-col gap-2 rounded-md border p-4",
                  !e.seen && "border-evergreen/40",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-wide text-ink">
                    <span aria-hidden className="text-evergreen text-sm">
                      {EVENT_GLYPH[e.type] ?? "•"}
                    </span>
                    {e.type.replace(/_/g, " ")}
                    {typeof e.payload.milestone === "number" && (
                      <span className="text-graphite normal-case tabular-nums">
                        · {e.payload.milestone}
                      </span>
                    )}
                  </span>
                  {e.occurredAt && (
                    <span className="text-graphite font-mono text-[0.7rem]">
                      {e.occurredAt.toLocaleDateString()}
                    </span>
                  )}
                </div>
                <p className="text-ink font-serif text-[0.95rem] leading-relaxed">
                  {e.text}
                </p>

              </li>
            ))}
          </ul>
        ) : (
          <p className="text-graphite text-sm">
            Nothing yet. Complete a session and your first recognition shows up
            here — for genuine work, never just time spent.
          </p>
        )}
      </section>

      {/* Capped, user-configurable reminders (anti-nag). */}
      <section className="flex flex-col gap-4">
        <h3 className="eyebrow border-b border-line/80 pb-3">Reminders</h3>
        <ReminderForm
          initial={{
            enabled: data.notifications.enabled,
            cadenceCap: data.notifications.cadenceCap,
          }}
          cap={data.notifications.cap}
        />
      </section>
    </div>
  );
}
