import type { PrismaClient } from "@prisma/client";

import type { Platform } from "@/integrations/adapter";

type ApiBudgetDb = Pick<PrismaClient, "apiCallBudget">;

const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_REQUESTS_PER_HOUR = 120;

export interface ApiBudgetPolicy {
  limit: number;
  windowMs: number;
}

export interface ApiBudgetDecision {
  allowed: boolean;
  count: number;
  limit: number;
  windowStart: Date;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function apiBudgetPolicy(platform: Platform): ApiBudgetPolicy {
  const specific =
    platform === "lichess"
      ? process.env.LICHESS_API_REQUESTS_PER_HOUR
      : process.env.CHESSCOM_API_REQUESTS_PER_HOUR;
  return {
    limit: positiveInteger(specific, DEFAULT_REQUESTS_PER_HOUR),
    windowMs: HOUR_MS,
  };
}

export function apiBudgetWindowStart(now: Date, windowMs: number): Date {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

/**
 * Atomically consume one request from a fixed-window bucket. The update-first,
 * create-second sequence handles existing buckets without a read/write race. If
 * concurrent callers both observe a missing bucket, the unique index lets only one
 * create it and the loser retries the bounded update.
 */
export async function consumeApiCallBudget(
  db: ApiBudgetDb,
  userId: string,
  platform: Platform,
  now: Date,
  policy: ApiBudgetPolicy = apiBudgetPolicy(platform),
): Promise<ApiBudgetDecision> {
  const windowStart = apiBudgetWindowStart(now, policy.windowMs);
  const key = { userId, platform, windowStart };

  const incremented = await db.apiCallBudget.updateMany({
    where: { ...key, count: { lt: policy.limit } },
    data: { count: { increment: 1 } },
  });
  if (incremented.count === 1) {
    const bucket = await db.apiCallBudget.findUniqueOrThrow({
      where: { userId_platform_windowStart: key },
      select: { count: true },
    });
    return {
      allowed: true,
      count: bucket.count,
      limit: policy.limit,
      windowStart,
    };
  }

  try {
    await db.apiCallBudget.create({ data: { ...key, count: 1 } });
    return { allowed: true, count: 1, limit: policy.limit, windowStart };
  } catch {
    const retried = await db.apiCallBudget.updateMany({
      where: { ...key, count: { lt: policy.limit } },
      data: { count: { increment: 1 } },
    });
    if (retried.count === 1) {
      const bucket = await db.apiCallBudget.findUniqueOrThrow({
        where: { userId_platform_windowStart: key },
        select: { count: true },
      });
      return {
        allowed: true,
        count: bucket.count,
        limit: policy.limit,
        windowStart,
      };
    }
  }

  return {
    allowed: false,
    count: policy.limit,
    limit: policy.limit,
    windowStart,
  };
}

export class ApiCallBudgetExceededError extends Error {
  constructor(
    readonly platform: Platform,
    readonly retryAt: Date,
  ) {
    super(
      `${platform} request budget exhausted; retry after ${retryAt.toISOString()}`,
    );
    this.name = "ApiCallBudgetExceededError";
  }
}

export async function assertApiCallBudget(
  db: ApiBudgetDb,
  userId: string,
  platform: Platform,
  now = new Date(),
): Promise<void> {
  const policy = apiBudgetPolicy(platform);
  const decision = await consumeApiCallBudget(
    db,
    userId,
    platform,
    now,
    policy,
  );
  if (!decision.allowed) {
    throw new ApiCallBudgetExceededError(
      platform,
      new Date(decision.windowStart.getTime() + policy.windowMs),
    );
  }
}
