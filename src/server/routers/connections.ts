// Connection management API (BUILD.md M1). Lists a user's platform connections,
// links Lichess or Chess.com by username after public profile validation, and
// disconnects/revokes a connection. Lichess OAuth remains a sign-in provider and
// its Auth.js event can still create a token-backed connection.

import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { PlatformError, type Platform } from "@/integrations/adapter";
import { chessComAdapter } from "@/integrations/chesscom/adapter";
import { lichessAdapter } from "@/integrations/lichess/adapter";
import { revokeLichessToken } from "@/integrations/lichess/adapter";
import {
  ApiCallBudgetExceededError,
  assertApiCallBudget,
} from "@/server/api-budget";
import {
  replacesOAuthUsername,
  upsertPlatformConnection,
} from "@/server/connections";
import { expectedError } from "@/server/errors";
import { publicProcedure, router } from "@/server/trpc";
import { lockUserProgramMutation } from "@/db/user-mutation-lock";

function profileLookupError(
  error: unknown,
  platform: Platform,
  username: string,
) {
  const label = platform === "lichess" ? "Lichess" : "Chess.com";
  if (error instanceof PlatformError && error.code === "not_found") {
    return expectedError.badRequest(
      `No ${label} player "${username}" was found. Check the spelling and try again.`,
      error,
    );
  }
  if (
    error instanceof ApiCallBudgetExceededError ||
    (error instanceof PlatformError && error.code === "rate_limited")
  ) {
    return expectedError.tooManyRequests(
      `${label} is limiting requests right now. Wait a moment, then try again.`,
      error,
    );
  }
  if (error instanceof PlatformError) {
    return expectedError.upstreamUnavailable(
      `${label} did not respond. Your account was not added. Try again in a moment.`,
      error,
    );
  }
  throw error;
}

export const connectionsRouter = router({
  // Tokens are NEVER selected — the client only sees safe metadata.
  list: publicProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      return [];
    }
    return ctx.prisma.platformConnection.findMany({
      where: { userId },
      orderBy: { connectedAt: "asc" },
      select: {
        id: true,
        platform: true,
        externalUsername: true,
        status: true,
        connectedAt: true,
        lastSyncedAt: true,
      },
    });
  }),

  // The user's preferred home platform — defaults the constraints/onboarding picker and the
  // Today "play a game" deep link. Set via analysis.setPrimaryPlatform.
  getPrimaryPlatform: publicProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      return { primaryPlatform: null };
    }
    const user = await ctx.prisma.user.findUnique({
      where: { id: userId },
      select: { primaryPlatform: true },
    });
    return { primaryPlatform: user?.primaryPlatform ?? null };
  }),

  addLichessUsername: publicProcedure
    .input(z.object({ username: z.string().trim().min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      let profile;
      try {
        profile = await lichessAdapter.fetchProfile({
          platform: "lichess",
          externalUsername: input.username,
          beforeRequest: () => {
            if (userId) {
              return assertApiCallBudget(ctx.prisma, userId, "lichess", new Date());
            }
            return Promise.resolve();
          },
        });
      } catch (err) {
        throw profileLookupError(err, "lichess", input.username);
      }

      if (!userId) {
        return {
          id: `guest_conn_lichess_${Date.now()}`,
          platform: "lichess" as const,
          externalUsername: profile.externalUsername,
          ratings: profile.ratings,
        };
      }

      const existing = await ctx.prisma.platformConnection.findUnique({
        where: {
          userId_platform: { userId, platform: "lichess" },
        },
        select: { externalUsername: true, accessToken: true },
      });
      if (replacesOAuthUsername(existing, profile.externalUsername)) {
        throw expectedError.conflict(
          "Disconnect the signed-in Lichess account before linking a different username.",
        );
      }
      const conn = await upsertPlatformConnection({
        userId,
        platform: "lichess",
        externalUsername: profile.externalUsername,
      });

      if (profile.ratings && Object.keys(profile.ratings).length > 0) {
        await ctx.prisma.chessProfileSnapshot.create({
          data: {
            id: `snapshot_${conn.id}_${Date.now()}`,
            userId,
            platform: "lichess",
            capturedAt: new Date(),
            ratings: profile.ratings as unknown as Prisma.InputJsonValue,
            totalGames: profile.totalGames ?? 0,
            raw: {},
          },
        });
      }

      return {
        id: conn.id,
        platform: conn.platform,
        externalUsername: conn.externalUsername,
        ratings: profile.ratings,
      };
    }),

  addChessComUsername: publicProcedure
    .input(z.object({ username: z.string().trim().min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      let profile;
      try {
        // fetchProfile doubles as validation: it 404s for a non-existent player.
        profile = await chessComAdapter.fetchProfile({
          platform: "chesscom",
          externalUsername: input.username,
          beforeRequest: () => {
            if (userId) {
              return assertApiCallBudget(ctx.prisma, userId, "chesscom", new Date());
            }
            return Promise.resolve();
          },
        });
      } catch (err) {
        throw profileLookupError(err, "chesscom", input.username);
      }

      if (!userId) {
        return {
          id: `guest_conn_chesscom_${Date.now()}`,
          platform: "chesscom" as const,
          externalUsername: profile.externalUsername,
          ratings: profile.ratings,
        };
      }

      const conn = await upsertPlatformConnection({
        userId,
        platform: "chesscom",
        externalUsername: profile.externalUsername,
      });

      if (profile.ratings && Object.keys(profile.ratings).length > 0) {
        await ctx.prisma.chessProfileSnapshot.create({
          data: {
            id: `snapshot_${conn.id}_${Date.now()}`,
            userId,
            platform: "chesscom",
            capturedAt: new Date(),
            ratings: profile.ratings as unknown as Prisma.InputJsonValue,
            totalGames: profile.totalGames ?? 0,
            raw: {},
          },
        });
      }

      return {
        id: conn.id,
        platform: conn.platform,
        externalUsername: conn.externalUsername,
        ratings: profile.ratings,
      };
    }),

  disconnect: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        return { id: input.id };
      }
      const conn = await ctx.prisma.platformConnection.findFirst({
        where: { id: input.id, userId },
      });
      if (!conn) {
        throw expectedError.notFound(
          "That connection no longer exists. Reload your connections to see the latest list.",
        );
      }
      // Best-effort token revocation so we stop holding a live Lichess credential.
      if (conn.platform === "lichess" && conn.accessToken) {
        await revokeLichessToken(conn.accessToken, () =>
          assertApiCallBudget(ctx.prisma, userId, "lichess", new Date()),
        ).catch(() => {
          /* local disconnect proceeds regardless (§6.2) */
        });
      }
      await ctx.prisma.$transaction(async (tx) => {
        await lockUserProgramMutation(tx, userId);
        // Import jobs are not relational rows, so erase their correlatable
        // connection id before the connection itself becomes undiscoverable.
        await tx.jobRun.deleteMany({
          where: { key: { endsWith: `:${conn.id}` } },
        });
        await tx.platformConnection.deleteMany({
          where: { id: conn.id, userId },
        });
      });
      return { id: conn.id };
    }),
});
