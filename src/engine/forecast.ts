import { DAY_MS } from "@/lib/clock";
import type {
  AvailabilityOverrideInput,
  ForecastBlock,
  WeeklyAvailabilityInput,
} from "@/lib/program-forecast";

export interface ForecastDraft {
  date: number;
  expectedMinutes: number;
  plannedBlocks: ForecastBlock[];
}

function dayStart(epoch: number): number {
  const date = new Date(epoch);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function budgetFor(
  date: number,
  fallbackMinutes: number,
  availability: WeeklyAvailabilityInput,
  override: AvailabilityOverrideInput | undefined,
): number {
  if (override?.unavailable) return 0;
  if (override?.minutes != null) return override.minutes;
  const weekday = new Date(date).getUTCDay();
  if (
    availability.mode === "preferred" &&
    !availability.preferredWeekdays.includes(weekday)
  ) {
    return 0;
  }
  return availability.defaultMinutesByDay[String(weekday)] ?? fallbackMinutes;
}

/** Generic deterministic seven-day projection. It packs activity-level blocks only. */
export function buildSevenDayForecast(input: {
  now: number;
  fallbackMinutes: number;
  availability: WeeklyAvailabilityInput;
  overrides: readonly AvailabilityOverrideInput[];
  candidateBlocks: readonly ForecastBlock[];
}): ForecastDraft[] {
  const start = dayStart(input.now);
  const overrides = new Map(
    input.overrides.map((item) => [dayStart(item.date), item]),
  );
  return Array.from({ length: 7 }, (_, index) => {
    const date = start + index * DAY_MS;
    const budget = budgetFor(
      date,
      input.fallbackMinutes,
      input.availability,
      overrides.get(date),
    );
    let used = 0;
    const plannedBlocks: ForecastBlock[] = [];
    for (const block of input.candidateBlocks) {
      if (used + block.expectedMinutes > budget) continue;
      plannedBlocks.push({ ...block });
      used += block.expectedMinutes;
    }
    return { date, expectedMinutes: used, plannedBlocks };
  });
}
