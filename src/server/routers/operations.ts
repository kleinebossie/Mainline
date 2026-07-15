import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { expectedError } from "@/server/errors";
import { retryFailedJob } from "@/server/maintenance";
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
    return ctx.prisma.jobRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 50,
      select: {
        id: true,
        kind: true,
        status: true,
        attempt: true,
        startedAt: true,
        finishedAt: true,
        errorCode: true,
      },
    });
  }),

  retryJob: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.prisma, ctx.userId);
      return retryFailedJob(ctx.prisma, input.id);
    }),
});
