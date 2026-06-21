// The methodology loader (BUILD.md §2.6). Loads a versioned config JSON, validates it
// against the Zod schema (structure + every leaf graded + every citation resolves, L3),
// deep-freezes it, and caches it per process. Fail-closed: an invalid config is a boot
// error, never a silent fallback. Determinism (L2) depends on the immutability here.

import {
  methodologyConfigSchema,
  type MethodologyConfig,
} from "@/methodology/schema/config";
import stub010 from "@/methodology/configs/stub-0.1.0.json";

// Configs ship as repo JSON (src/methodology/configs/<version>.json). Register each
// here; the research config is added as a new file + a new entry, no engine change.
const RAW_CONFIGS: Readonly<Record<string, unknown>> = {
  "stub-0.1.0": stub010,
};

// The active version when none is requested: explicit arg > env > default latest stub.
const DEFAULT_VERSION = "stub-0.1.0";

const cache = new Map<string, MethodologyConfig>();

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const value of Object.values(obj)) deepFreeze(value);
  }
  return obj;
}

/**
 * Resolve, validate, freeze, and cache a MethodologyConfig.
 *  resolution: explicit `version` > env METHODOLOGY_VERSION > DEFAULT_VERSION.
 * Throws if the version is unknown or the config fails validation (fail-closed, §2.6).
 */
export function loadMethodology(version?: string): MethodologyConfig {
  const resolved =
    version ?? process.env.METHODOLOGY_VERSION ?? DEFAULT_VERSION;
  const cached = cache.get(resolved);
  if (cached) return cached;

  const raw = RAW_CONFIGS[resolved];
  if (!raw) {
    throw new Error(
      `Unknown methodology version "${resolved}". Known: ${Object.keys(RAW_CONFIGS).join(", ")}`,
    );
  }

  const parsed = methodologyConfigSchema.parse(raw); // throws on any violation (L3)
  if (parsed.version !== resolved) {
    throw new Error(
      `Methodology version mismatch: requested "${resolved}" but config declares "${parsed.version}".`,
    );
  }

  const frozen = deepFreeze(parsed);
  cache.set(resolved, frozen);
  return frozen;
}

/** The version string the loader resolves by default (persisted for reproducibility). */
export const ACTIVE_METHODOLOGY_VERSION = DEFAULT_VERSION;
