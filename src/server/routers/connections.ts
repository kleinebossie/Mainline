// Connection management API (BUILD.md M1). Lists a user's platform connections,
// links Lichess or Chess.com by username after public profile validation, and
// disconnects/revokes a connection. Lichess OAuth remains a sign-in provider and
// its Auth.js event can still create a token-backed connection.

import { z } from "zod";

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
import { protectedProcedure, router } from "@/server/trpc";
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
  list: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.platformConnection.findMany({
      where: { userId: ctx.userId },
      orderBy: { connectedAt: "asc" },
      select: {
        id: true,
        platform: true,
        externalUsername: true,
        status: true,
        connectedAt: true,
        lastSyncedAt: true,
      },
    }),
  ),

  // The user's preferred home platform — defaults the constraints/onboarding picker and the
  // Today "play a game" deep link. Set via analysis.setPrimaryPlatform.
  getPrimaryPlatform: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { primaryPlatform: true },
    });
    return { primaryPlatform: user?.primaryPlatform ?? null };
  }),

  addLichessUsername: protectedProcedure
    .input(z.object({ username: z.string().trim().min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      let profile;
      try {
        profile = await lichessAdapter.fetchProfile({
          platform: "lichess",
          externalUsername: input.username,
          beforeRequest: () =>
            assertApiCallBudget(ctx.prisma, ctx.userId, "lichess", new Date()),
        });
      } catch (err) {
        throw profileLookupError(err, "lichess", input.username);
      }
      const existing = await ctx.prisma.platformConnection.findUnique({
        where: {
          userId_platform: { userId: ctx.userId, platform: "lichess" },
        },
        select: { externalUsername: true, accessToken: true },
      });
      if (replacesOAuthUsername(existing, profile.externalUsername)) {
        throw expectedError.conflict(
          "Disconnect the signed-in Lichess account before linking a different username.",
        );
      }
      const conn = await upsertPlatformConnection({
        userId: ctx.userId,
        platform: "lichess",
        externalUsername: profile.externalUsername,
      });
      return {
        id: conn.id,
        platform: conn.platform,
        externalUsername: conn.externalUsername,
      };
    }),

  addChessComUsername: protectedProcedure
    .input(z.object({ username: z.string().trim().min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      let profile;
      try {
        // fetchProfile doubles as validation: it 404s for a non-existent player.
        profile = await chessComAdapter.fetchProfile({
          platform: "chesscom",
          externalUsername: input.username,
          beforeRequest: () =>
            assertApiCallBudget(ctx.prisma, ctx.userId, "chesscom", new Date()),
        });
      } catch (err) {
        throw profileLookupError(err, "chesscom", input.username);
      }
      const conn = await upsertPlatformConnection({
        userId: ctx.userId,
        platform: "chesscom",
        externalUsername: profile.externalUsername,
      });
      return {
        id: conn.id,
        platform: conn.platform,
        externalUsername: conn.externalUsername,
      };
    }),

  disconnect: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const conn = await ctx.prisma.platformConnection.findFirst({
        where: { id: input.id, userId: ctx.userId },
      });
      if (!conn) {
        throw expectedError.notFound(
          "That connection no longer exists. Reload your connections to see the latest list.",
        );
      }
      // Best-effort token revocation so we stop holding a live Lichess credential.
      if (conn.platform === "lichess" && conn.accessToken) {
        await revokeLichessToken(conn.accessToken, () =>
          assertApiCallBudget(ctx.prisma, ctx.userId, "lichess", new Date()),
        ).catch(() => {
          /* local disconnect proceeds regardless (§6.2) */
        });
      }
      await ctx.prisma.$transaction(async (tx) => {
        await lockUserProgramMutation(tx, ctx.userId);
        // Import jobs are not relational rows, so erase their correlatable
        // connection id before the connection itself becomes undiscoverable.
        await tx.jobRun.deleteMany({
          where: { key: { endsWith: `:${conn.id}` } },
        });
        await tx.platformConnection.deleteMany({
          where: { id: conn.id, userId: ctx.userId },
        });
      });
      return { id: conn.id };
    }),
});
