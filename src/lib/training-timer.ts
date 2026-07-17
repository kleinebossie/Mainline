const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_SECOND = 1_000;

export function allottedTrainingMs(
  allocatedMinutes: number | null | undefined,
): number | null {
  if (
    typeof allocatedMinutes !== "number" ||
    !Number.isFinite(allocatedMinutes) ||
    allocatedMinutes <= 0
  ) {
    return null;
  }

  const durationMs = Math.round(allocatedMinutes * MILLISECONDS_PER_MINUTE);
  return durationMs > 0 ? durationMs : null;
}

export function trainingDeadlineMs(
  startedMs: number,
  allocatedMinutes: number | null | undefined,
): number | null {
  const durationMs = allottedTrainingMs(allocatedMinutes);
  return durationMs === null ? null : startedMs + durationMs;
}

export function trainingTimeRemainingMs(
  deadlineMs: number,
  nowMs: number,
): number {
  return Math.max(0, deadlineMs - nowMs);
}

export function formatTrainingCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(
    0,
    Math.ceil(remainingMs / MILLISECONDS_PER_SECOND),
  );
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
