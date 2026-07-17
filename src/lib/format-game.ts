// Small pure display helpers for imported games — used by the analysis surfaces so the user
// always knows *which* game they are looking at. UI formatting only (no Engine decision).

export function resultLabel(result: string | null | undefined): string {
  if (result === "win") return "Win";
  if (result === "loss") return "Loss";
  if (result === "draw") return "Draw";
  return "Unrated";
}

export function colorWord(color: string | null | undefined): string {
  if (color === "w") return "White";
  if (color === "b") return "Black";
  return "—";
}

export function platformLabel(platform: string | null | undefined): string {
  if (platform === "lichess") return "Lichess";
  if (platform === "chesscom") return "Chess.com";
  if (platform === "manual") return "Manual PGN";
  return platform ?? "—";
}

export function formatGameDate(
  value: Date | string | number | null | undefined,
  platform?: string | null,
): string {
  if (value == null) return "Date unknown";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unknown";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(platform === "manual" ? { timeZone: "UTC" } : {}),
  });
}
