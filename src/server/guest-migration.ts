// Guest session migration procedure (BETA_PRIORITIZATION_PLAN.md §3.3).
// Imports guest baseline, constraints, program items, and activity events into PostgreSQL upon OAuth sign-in.

import { z } from "zod";
import type { PrismaClient, Prisma } from "@prisma/client";
import { loadMethodology } from "@/methodology";

export const guestMigrationInputSchema = z.object({
  baseline: z
    .object({
      username: z.string().optional(),
      platform: z.enum(["lichess", "chesscom"]).optional(),
      tacticalRatingEstimate: z.number().int().optional(),
      uncertainty: z.number().int().optional(),
      topBlindspot: z.string().optional(),
    })
    .nullable()
    .optional(),
  constraints: z
    .object({
      minutesPerDay: z.number().int().min(5).max(180),
      daysPerWeek: z.number().int().min(1).max(7),
      formatPrefs: z.object({
        formats: z.array(z.string()),
        preferredVariety: z.boolean().optional(),
        targetFocus: z.enum(["online", "otb", "hybrid"]).default("online"),
      }),
      goals: z.array(z.string()).optional(),
      ownedResources: z.array(z.any()).optional(),
    })
    .nullable()
    .optional(),
  program: z
    .object({
      methodologyVersion: z.string(),
      items: z.array(
        z.object({
          id: z.string().optional(),
          orderIndex: z.number().int(),
          activityId: z.string(),
          activityType: z.string(),
          label: z.string().optional(),
          params: z.record(z.unknown()).optional(),
          dimensionsTargeted: z.array(z.string()).optional(),
          rationaleKey: z.string().optional(),
          rationaleText: z.string().optional(),
          evidenceGrade: z.string().optional(),
          evidenceTier: z.number().int().optional(),
          citationKey: z.string().optional(),
          confidence: z.string().optional(),
          soften: z.boolean().optional(),
          status: z.enum(["pending", "done", "skipped"]).default("pending"),
        }),
      ),
    })
    .nullable()
    .optional(),
  activityEvents: z
    .array(
      z.object({
        type: z.string(),
        occurredAt: z.string(),
        programItemId: z.string().optional(),
        payload: z.record(z.unknown()),
      }),
    )
    .optional(),
});

export type GuestMigrationInput = z.infer<typeof guestMigrationInputSchema>;

export interface GuestMigrationResult {
  success: boolean;
  itemsMigrated: number;
  hasAssessment: boolean;
  hasConstraints: boolean;
}

/**
 * Atomically migrate guest onboarding data to the authenticated user account.
 */
export async function migrateGuestSession(
  db: PrismaClient,
  userId: string,
  input: GuestMigrationInput,
): Promise<GuestMigrationResult> {
  const cfg = loadMethodology();
  const methodologyVersion = input.program?.methodologyVersion ?? cfg.version;

  return await db.$transaction(async (tx) => {
    let hasAssessment = false;
    let hasConstraints = false;

    // 1. Connect Platform if username was analyzed on homepage.
    if (input.baseline?.username && input.baseline.platform) {
      const platform = input.baseline.platform;
      const username = input.baseline.username;

      const existingConn = await tx.platformConnection.findFirst({
        where: { userId, platform },
      });

      if (!existingConn) {
        await tx.platformConnection.create({
          data: {
            userId,
            platform,
            externalUsername: username,
            status: "active",
          },
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: { primaryPlatform: platform },
      });
    }

    // 2. Upsert Tactical Baseline Assessment.
    if (input.baseline) {
      hasAssessment = true;
      const rating = input.baseline.tacticalRatingEstimate ?? 1450;
      const uncertainty = input.baseline.uncertainty ?? 180;

      await tx.assessment.upsert({
        where: { userId },
        create: {
          userId,
          completedAt: new Date(),
          calibrationResponses: [],
          tacticalRatingEstimate: rating,
          uncertainty,
          methodologyVersion,
        },
        update: {
          completedAt: new Date(),
          tacticalRatingEstimate: rating,
          uncertainty,
          methodologyVersion,
        },
      });
    }

    // 3. Upsert User Constraints.
    if (input.constraints) {
      hasConstraints = true;
      await tx.constraintSet.updateMany({
        where: { userId, isCurrent: true },
        data: { isCurrent: false },
      });

      const goalsJson = (input.constraints.goals ?? ["tactics"]).map((g) => ({
        kind: g,
        label: g,
      }));

      await tx.constraintSet.create({
        data: {
          userId,
          minutesPerDay: input.constraints.minutesPerDay,
          daysPerWeek: input.constraints.daysPerWeek,
          goals: goalsJson as unknown as Prisma.InputJsonValue,
          formatPrefs: {
            formats: input.constraints.formatPrefs.formats,
            preferredVariety: Boolean(
              input.constraints.formatPrefs.preferredVariety,
            ),
            targetFocus: input.constraints.formatPrefs.targetFocus ?? "online",
          } as unknown as Prisma.InputJsonValue,
          ownedResources: (input.constraints.ownedResources ??
            []) as unknown as Prisma.InputJsonValue,
          isCurrent: true,
          version: 1,
        },
      });
    }

    // 4. Import Program and ProgramItems.
    let itemsMigrated = 0;
    if (input.program && input.program.items.length > 0) {
      await tx.program.updateMany({
        where: { userId, status: "active" },
        data: { status: "superseded" },
      });

      const newProgram = await tx.program.create({
        data: {
          userId,
          methodologyVersion,
          status: "active",
          generationInput: {
            source: "guest_migration",
          } as unknown as Prisma.InputJsonValue,
        },
      });

      const idMap = new Map<string, string>();

      for (const item of input.program.items) {
        const createdItem = await tx.programItem.create({
          data: {
            programId: newProgram.id,
            date: new Date(),
            orderIndex: item.orderIndex,
            activityId: item.activityId,
            activityType: item.activityType,
            params: (item.params ?? {}) as unknown as Prisma.InputJsonValue,
            dimensionsTargeted: item.dimensionsTargeted ?? [],
            rationaleKey: item.rationaleKey ?? "blunder_rate_weakness",
            rationaleText:
              item.rationaleText ??
              "Personalized based on your blunder analysis.",
            evidenceGrade: item.evidenceGrade ?? "A",
            evidenceTier: item.evidenceTier ?? 1,
            citationKey: item.citationKey ?? "de_groot_1965",
            confidence: item.confidence ?? "high",
            soften: Boolean(item.soften),
            status: item.status,
          },
        });
        itemsMigrated += 1;
        if (item.id) {
          idMap.set(item.id, createdItem.id);
        }
      }

      // 5. Import ActivityEvents if present.
      if (input.activityEvents && input.activityEvents.length > 0) {
        for (const evt of input.activityEvents) {
          const mappedItemId = evt.programItemId
            ? idMap.get(evt.programItemId)
            : undefined;
          await tx.activityEvent.create({
            data: {
              userId,
              programItemId: mappedItemId,
              type: evt.type,
              occurredAt: new Date(evt.occurredAt),
              payload: evt.payload as unknown as Prisma.InputJsonValue,
              source: "user",
            },
          });
        }
      }
    }

    // 6. Mark setup reveal seen.
    await tx.user.update({
      where: { id: userId },
      data: { setupRevealSeenAt: new Date() },
    });

    return {
      success: true,
      itemsMigrated,
      hasAssessment,
      hasConstraints,
    };
  });
}
