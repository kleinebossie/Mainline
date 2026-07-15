export type PrimaryPlatform = "lichess" | "chesscom";

interface PrimaryPlatformSaveState {
  explicitSelection: PrimaryPlatform | null;
  effectivePlatform: PrimaryPlatform;
  savedPlatform: PrimaryPlatform | null | undefined;
  savedPlatformLoaded: boolean;
}

/** Avoid persisting a guessed fallback when the saved preference failed to load. */
export function shouldPersistPrimaryPlatform({
  explicitSelection,
  effectivePlatform,
  savedPlatform,
  savedPlatformLoaded,
}: PrimaryPlatformSaveState): boolean {
  return (
    (savedPlatformLoaded || explicitSelection !== null) &&
    effectivePlatform !== savedPlatform
  );
}
