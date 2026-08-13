import type { TodayItem, TodayProgram } from "@/server/program";

export function humanizeFocusArea(focusArea: string): string {
  const words = focusArea.replace(/_/g, " ").trim();
  return words.length > 0
    ? `${words.charAt(0).toUpperCase()}${words.slice(1)}`
    : "Training focus";
}

export function focusSourceLabel(source: string): string {
  if (source === "measured weakness") return "recent measured needs";
  if (source === "skill history") return "your skill history";
  if (source === "due learning") return "reviews that are due";
  if (source === "variety fit") return "training variety";
  if (source === "bounded fit preference") return "your training preferences";
  if (source === "methodology prior") return "the methodology baseline";
  if (source.startsWith("process goal:")) return "your stated goal";
  return humanizeFocusArea(source).toLowerCase();
}

export function formatForecastDate(epoch: number): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(epoch));
}

export function formatMeasuredMinutes(
  minutes: number | null,
  truncated = false,
): string {
  if (minutes == null) {
    return truncated ? "No measured time in view" : "Not measured";
  }
  const measured =
    minutes < 1 && minutes > 0
      ? "Less than 1 min"
      : `${Math.round(minutes)} min`;
  if (truncated && minutes > 0 && minutes < 1) {
    return "At least some measured time";
  }
  return truncated ? `At least ${measured.toLowerCase()}` : measured;
}

export function formatMeasurementCoverage(
  measuredEvents: number,
  eventCount: number,
  truncated: boolean,
): string | null {
  if (eventCount === 0) return null;
  if (measuredEvents === eventCount && !truncated) {
    return `${eventCount} ${eventCount === 1 ? "log" : "logs"} timed`;
  }
  if (truncated) {
    return `At least ${measuredEvents} of ${eventCount} logs timed`;
  }
  return `${measuredEvents} of ${eventCount} logs timed`;
}

export function formatProgramVersionTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

export function isSameUtcDay(left: Date, right: Date): boolean {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
}

export function formatMinuteCap(minutes: number | null | undefined): string {
  if (minutes == null) return "Up to available time";
  return `Up to ${Math.max(1, Math.ceil(minutes))} min`;
}

export function sessionMinuteCap(program: TodayProgram): string {
  const total = program.items.reduce(
    (sum, item) => sum + (item.estMinutes ?? 0),
    0,
  );
  return formatMinuteCap(total > 0 ? total : null);
}

export function itemSummary(item: TodayItem): string {
  const p = item.params;
  if (item.activityType === "spaced_review") {
    return item.reviewThemes.length > 0
      ? `Review due failed tactics: ${item.reviewThemes.join(", ")}.`
      : "Review due failed tactics.";
  }
  if (item.activityType === "blunder_drill") {
    return "Revisit mistakes from your own games and find the better move.";
  }
  if (item.activityType === "book") {
    return p.bookResource
      ? `Study ${p.bookResource.title}, then log the session here.`
      : "Study a recommended book, then log the session here.";
  }
  if (item.activityType === "analyse") {
    return "Review one game with the engine withheld until you have tried first.";
  }
  if (item.activityType === "study") {
    return "Use the recommended external study material, then log the work.";
  }
  if (item.activityType === "play_game") {
    return "Play rated games on your platform, then log that the block is done.";
  }
  if (item.activityType === "endgame_drill") {
    return "Play out the endgame position and convert the result.";
  }
  if (p.track === "calculation") {
    return "Take the slower calculation track and solve before moving.";
  }
  if (p.track === "pattern") {
    return "Train pattern recognition at today's difficulty target.";
  }
  return "Do this away from the app, then log it below.";
}

export function itemMeta(item: TodayItem): string[] {
  const meta = [...item.dimensionLabels];
  if (item.params.structure) meta.push(item.params.structure);
  if (item.params.workedExample) meta.push("worked example first");
  return meta;
}

export function rowStatusLabel(item: TodayItem): string {
  if (item.status === "done") return "Done";
  if (item.status === "skipped") return "Skipped";
  if (item.activityType === "book") return "Log";
  if (item.delivery === "external") return "External";
  return "Ready";
}

export function isClosedItem(item: TodayItem): boolean {
  return item.status === "done" || item.status === "skipped";
}

export function isAutoLoggedInternal(item: TodayItem): boolean {
  return (
    item.delivery === "internal" &&
    (item.activityType === "puzzle_theme" ||
      item.activityType === "spaced_review" ||
      item.activityType === "blunder_drill" ||
      item.activityType === "endgame_drill")
  );
}

export function isPuzzleAttemptLoggable(item: TodayItem): boolean {
  return item.params.track !== null && item.activityType !== "spaced_review";
}

export function activityActionLabel(item: TodayItem): string {
  if (item.activityType === "analyse") return "Open review";
  if (item.activityType === "book") return "Log";
  return "Start";
}

export type PrimaryActionKind = "internal" | "external" | "completion" | null;

export function primaryActionKind(item: TodayItem): PrimaryActionKind {
  if (isClosedItem(item)) return null;
  if (item.delivery === "internal" && item.url) return "internal";
  if (item.delivery === "external" && item.externalUrl) return "external";
  if (item.activityType !== "book" && !isAutoLoggedInternal(item)) {
    return "completion";
  }
  return null;
}

export function completionEventType(
  item: TodayItem,
): "drill_done" | "game_played" {
  return item.activityType === "play_game" ? "game_played" : "drill_done";
}

export function firstIncompleteItem(
  items: readonly TodayItem[],
): TodayItem | null {
  return items.find((item) => !isClosedItem(item)) ?? null;
}

export function isFirstBlockActive(items: readonly TodayItem[]): boolean {
  const first = items[0];
  if (!first) return false;
  const active = firstIncompleteItem(items);
  return active?.id === first.id;
}
