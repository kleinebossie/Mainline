export type ResultPersistenceState = "ready" | "saving" | "failed";

export function resultPersistenceState(
  pending: boolean,
  error: unknown,
): ResultPersistenceState {
  if (pending) return "saving";
  if (error != null) return "failed";
  return "ready";
}

export function resultAdvanceBlocked(state: ResultPersistenceState): boolean {
  return state !== "ready";
}

export function resultAdvanceLabel(
  state: ResultPersistenceState,
  readyLabel: string,
): string {
  if (state === "saving") return "Saving result...";
  if (state === "failed") return "Save result to continue";
  return readyLabel;
}
