import type { TodayItem, TodayProgram } from "@/server/program";

export type Grade = "A" | "B" | "C" | "D";

export function asGrade(g: string): Grade {
  return g === "A" || g === "B" || g === "C" || g === "D" ? g : "C";
}

export function formatMinuteCap(minutes: number | null | undefined): string {
  if (minutes == null) return "up to available time";
  return `up to ${Math.max(1, Math.ceil(minutes))} min`;
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
