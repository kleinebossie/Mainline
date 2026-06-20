// Tiny pure PGN tag reader (BUILD.md §6). Pulls a single `[Tag "value"]` from a PGN
// header without a full parser — enough to recover ECO/opening when a provider does
// not expose them as fields. Raw extraction only; no chess interpretation (L1).

/** Returns the value of a PGN seven-tag-roster/extra tag, or undefined if absent. */
export function pgnTag(pgn: string, tag: string): string | undefined {
  const re = new RegExp(`\\[${tag}\\s+"([^"]*)"\\]`);
  const m = re.exec(pgn);
  const value = m?.[1]?.trim();
  return value ? value : undefined;
}
