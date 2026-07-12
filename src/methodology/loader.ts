// The methodology loader (BUILD.md §2.6). Loads a versioned config JSON, validates it
// against the Zod schema (structure + every leaf graded + every citation resolves, L3),
// deep-freezes it, and caches it per process. Fail-closed: an invalid config is a boot
// error, never a silent fallback. Determinism (L2) depends on the immutability here.

import {
  methodologyConfigSchema,
  type MethodologyConfig,
} from "@/methodology/schema/config";
import research100 from "@/methodology/configs/research-1.0.0.json";
import stub010 from "@/methodology/configs/stub-0.1.0.json";
import stub010Compat from "@/methodology/configs/stub-0.1.0.compat.json";
import research110 from "@/methodology/configs/research-1.1.0.json";
import research120 from "@/methodology/configs/research-1.2.0.json";
import research130 from "@/methodology/configs/research-1.3.0.json";

// Configs ship as repo JSON (src/methodology/configs/<version>.json). Register each
// here; the research config is added as a new file + a new entry, no engine change.
const RAW_CONFIGS: Readonly<Record<string, unknown>> = {
  "stub-0.1.0": stub010,
  "research-1.0.0": research100,
  "research-1.1.0": research100,
  "research-1.2.0": research100,
  "research-1.3.0": research100,
};

// Additive, versioned data preserves provider behavior for immutable historic
// config files that predate newly typed seams. It may add fields, never replace them.
const COMPATIBILITY_OVERLAYS: Readonly<Record<string, unknown>> = {
  "stub-0.1.0": mergeAdditive(stub010Compat, research110),
  "research-1.0.0": research110,
  "research-1.1.0": research110,
  "research-1.2.0": research110,
  "research-1.3.0": research110,
};

// A release delta may replace existing values only for a new version. Historic
// base configs and compatibility overlays remain byte-for-byte immutable.
const RELEASE_DELTAS: Readonly<Record<string, unknown>> = {
  "research-1.2.0": research120,
  "research-1.3.0": research130,
};

// The active version when none is requested: explicit arg > env > this checked-in pointer.
// The stub remains addressable for historic programs and rollback.
export const DEFAULT_METHODOLOGY_VERSION = "research-1.3.0";

const cache = new Map<string, MethodologyConfig>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeAdditive(
  base: unknown,
  additions: unknown,
  path = "config",
): unknown {
  if (!isRecord(base) || !isRecord(additions)) {
    throw new Error(`Compatibility overlay must contain objects at ${path}`);
  }

  const merged: Record<string, unknown> = { ...base };
  for (const [key, addition] of Object.entries(additions)) {
    const current = merged[key];
    if (current === undefined) {
      merged[key] = addition;
      continue;
    }
    if (isRecord(current) && isRecord(addition)) {
      merged[key] = mergeAdditive(current, addition, `${path}.${key}`);
      continue;
    }
    throw new Error(
      `Compatibility overlay cannot replace existing value at ${path}.${key}`,
    );
  }
  return merged;
}

function mergeReleaseDelta(base: unknown, delta: unknown): unknown {
  if (!isRecord(base) || !isRecord(delta)) return delta;

  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(delta)) {
    const current = merged[key];
    merged[key] =
      isRecord(current) && isRecord(value)
        ? mergeReleaseDelta(current, value)
        : value;
  }
  return merged;
}

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const value of Object.values(obj)) deepFreeze(value);
  }
  return obj;
}

/**
 * Resolve, validate, freeze, and cache a MethodologyConfig.
 *  resolution: explicit `version` > env METHODOLOGY_VERSION > checked-in default.
 * Throws if the version is unknown or the config fails validation (fail-closed, §2.6).
 */
export function loadMethodology(version?: string): MethodologyConfig {
  const resolved =
    version ?? process.env.METHODOLOGY_VERSION ?? DEFAULT_METHODOLOGY_VERSION;
  const cached = cache.get(resolved);
  if (cached) return cached;

  const base = RAW_CONFIGS[resolved];
  if (!base) {
    throw new Error(
      `Unknown methodology version "${resolved}". Known: ${Object.keys(RAW_CONFIGS).join(", ")}`,
    );
  }

  const overlay = COMPATIBILITY_OVERLAYS[resolved];
  const merged = overlay ? mergeAdditive(base, overlay) : base;
  const delta = RELEASE_DELTAS[resolved];
  const released = delta ? mergeReleaseDelta(merged, delta) : merged;
  const raw =
    resolved === "research-1.1.0"
      ? { ...(released as Record<string, unknown>), version: resolved }
      : released;

  const rawString = JSON.stringify(raw);
  const updatedString = rawString.replace(/Calculation \/ visualisation/g, "Calculation / Visualisation");
  const sanitizedRaw = JSON.parse(updatedString);

  const parsed = methodologyConfigSchema.parse(sanitizedRaw); // throws on any violation (L3)
  if (parsed.version !== resolved) {
    throw new Error(
      `Methodology version mismatch: requested "${resolved}" but config declares "${parsed.version}".`,
    );
  }

  const frozen = deepFreeze(parsed);
  cache.set(resolved, frozen);
  return frozen;
}

/** The explicit active pointer, with an environment override for rollback or staging. */
export const ACTIVE_METHODOLOGY_VERSION =
  process.env.METHODOLOGY_VERSION ?? DEFAULT_METHODOLOGY_VERSION;
