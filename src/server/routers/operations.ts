import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { systemClock } from "@/lib/clock";
import { expectedError } from "@/server/errors";
import { RETRYABLE_JOB_KINDS, retryFailedJob } from "@/server/maintenance";
import { protectedProcedure, router } from "@/server/trpc";

async function requireAdmin(
  prisma: Pick<PrismaClient, "user">,
  userId: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, deletedAt: true },
  });
  if (!user || user.deletedAt || user.role !== "admin") {
    throw expectedError.forbidden("This area is limited to administrators.");
  }
}

export const operationsRouter = router({
  recentJobs: protectedProcedure.query(async ({ ctx }) => {
    await requireAdmin(ctx.prisma, ctx.userId);
    const now = new Date(systemClock.now());
    const select = {
      id: true,
      kind: true,
      status: true,
      attempt: true,
      startedAt: true,
      finishedAt: true,
      lockedUntil: true,
      errorCode: true,
    } as const;
    const actionable = await ctx.prisma.jobRun.findMany({
      where: {
        kind: { in: [...RETRYABLE_JOB_KINDS] },
        OR: [
          { status: { in: ["queued", "error"] } },
          { status: "running", lockedUntil: { lte: now } },
        ],
      },
      orderBy: { startedAt: "desc" },
      take: 50,
      select,
    });
    const recent =
      actionable.length < 50
        ? await ctx.prisma.jobRun.findMany({
            where:
              actionable.length > 0
                ? { id: { notIn: actionable.map((job) => job.id) } }
                : undefined,
            orderBy: { startedAt: "desc" },
            take: 50 - actionable.length,
            select,
          })
        : [];
    return [
      ...actionable.map((job) => ({ ...job, retryable: true })),
      ...recent.map((job) => ({ ...job, retryable: false })),
    ];
  }),

  retryJob: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.prisma, ctx.userId);
      return retryFailedJob(ctx.prisma, input.id);
    }),
});
