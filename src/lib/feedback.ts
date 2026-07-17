import { z } from "zod";

export const trainingFeedbackScopeSchema = z.enum(["program", "item"]);
export const trainingFeedbackSourceSchema = z.enum([
  "weekly_check_in",
  "always_available",
  "contextual",
]);
export const trainingFeedbackRelevanceSchema = z.enum([
  "relevant",
  "neutral",
  "not_relevant",
]);
export const trainingFeedbackEnjoymentSchema = z.enum([
  "enjoyed",
  "neutral",
  "not_enjoyed",
]);
export const trainingFeedbackTimeFitSchema = z.enum([
  "too_short",
  "fits",
  "too_long",
]);

export const trainingFeedbackInputSchema = z
  .object({
    requestId: z.string().min(1).max(120),
    scope: trainingFeedbackScopeSchema,
    source: trainingFeedbackSourceSchema,
    programId: z.string().min(1).max(120).optional(),
    programItemId: z.string().min(1).max(120).optional(),
    relevance: trainingFeedbackRelevanceSchema,
    enjoyment: trainingFeedbackEnjoymentSchema,
    timeFit: trainingFeedbackTimeFitSchema,
    frictionTags: z.array(z.string().min(1).max(80)).max(6).default([]),
    comment: z.string().trim().max(1000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.scope === "item" && !value.programItemId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["programItemId"],
        message: "Item feedback requires a training block.",
      });
    }
    if (value.scope === "program" && !value.programId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["programId"],
        message: "Program feedback requires a program.",
      });
    }
    if (value.scope === "program" && value.programItemId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["programItemId"],
        message: "Program feedback cannot target one training block.",
      });
    }
  });
export type TrainingFeedbackInput = z.infer<typeof trainingFeedbackInputSchema>;

export const productFeedbackInputSchema = z
  .object({
    requestId: z.string().min(1).max(120),
    category: z.enum(["bug", "confusing", "idea", "other"]),
    message: z.string().trim().min(1).max(2000),
    routeContext: z.string().max(300).optional(),
    contactAllowed: z.boolean(),
  })
  .strict();
export type ProductFeedbackInput = z.infer<typeof productFeedbackInputSchema>;

type FeedbackTargetItem = {
  id: string;
  programId: string;
};

/** Resolve a contextual Settings link only to a target present in the loaded user data. */
export function resolveFeedbackTarget(input: {
  requestedProgramItemId: string | null;
  requestedProgramId: string | null;
  activeProgramId: string | null;
  recentItems: FeedbackTargetItem[];
}): string {
  const requestedItem = input.recentItems.find(
    (item) => item.id === input.requestedProgramItemId,
  );
  if (requestedItem) return requestedItem.id;
  if (
    input.requestedProgramId &&
    input.requestedProgramId === input.activeProgramId
  ) {
    return `program:${input.requestedProgramId}`;
  }
  if (input.recentItems[0]) return input.recentItems[0].id;
  return input.activeProgramId ? `program:${input.activeProgramId}` : "";
}

export const preferenceOverrideInputSchema = z
  .object({ activityType: z.string().min(1).max(120).nullable() })
  .strict();

const STATIC_ROUTES = new Set([
  "/today",
  "/settings",
  "/library",
  "/progress",
  "/connections",
  "/analysis",
  "/train",
  "/onboarding",
]);

/** Reduce browser context to a route template. Query strings, fragments, and ids are dropped. */
export function safeRouteContext(raw: string | undefined): string | null {
  if (!raw) return null;
  const path = raw.split(/[?#]/, 1)[0]?.replace(/\/$/, "") || "/";
  if (STATIC_ROUTES.has(path)) return path;
  if (/^\/analysis\/[^/]+$/.test(path)) return "/analysis/[gameId]";
  if (/^\/train\/[^/]+$/.test(path)) return "/train/[itemId]";
  if (/^\/onboarding\/[^/]+$/.test(path)) return "/onboarding/[step]";
  return null;
}
