import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { expectedError } from "@/server/errors";
import {
  exportControlledObservationalResearch,
  MAX_RESEARCH_EXPORT_RECORDS,
  ResearchExportConfigurationError,
} from "@/server/research";
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

export const researchRouter = router({
  controlledExport: protectedProcedure
    .input(
      z
        .object({
          from: z.date(),
          to: z.date(),
          maxRecords: z.number().int().min(1).max(MAX_RESEARCH_EXPORT_RECORDS),
        })
        .strict(),
    )
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx.prisma, ctx.userId);
      try {
        return await exportControlledObservationalResearch(ctx.prisma, {
          ...input,
          secret: process.env.RESEARCH_EXPORT_SECRET ?? "",
        });
      } catch (error) {
        if (error instanceof ResearchExportConfigurationError) {
          throw expectedError.upstreamUnavailable(
            "Controlled research export is not configured.",
            error,
          );
        }
        throw error;
      }
    }),
});
