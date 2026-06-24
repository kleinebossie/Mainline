// Connection management API (BUILD.md M1). Lists a user's platform connections,
// links a Chess.com account by username (validated via PubAPI, stored tokenless),
// and disconnects/revokes a connection. Lichess linking happens through the OAuth
// flow + Auth.js events (see server/auth.ts), not here.

import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { PlatformError } from "@/integrations/adapter";
import { chessComAdapter } from "@/integrations/chesscom/adapter";
import { revokeLichessToken } from "@/integrations/lichess/adapter";
import { upsertPlatformConnection } from "@/server/connections";
import { protectedProcedure, router } from "@/server/trpc";

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

  addChessComUsername: protectedProcedure
    .input(z.object({ username: z.string().trim().min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      let profile;
      try {
        // fetchProfile doubles as validation: it 404s for a non-existent player.
        profile = await chessComAdapter.fetchProfile({
          platform: "chesscom",
          externalUsername: input.username,
        });
      } catch (err) {
        if (err instanceof PlatformError && err.code === "not_found") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `No Chess.com player "${input.username}".`,
          });
        }
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: "Couldn't reach Chess.com right now. Please try again.",
        });
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
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      // Best-effort token revocation so we stop holding a live Lichess credential.
      if (conn.platform === "lichess" && conn.accessToken) {
        await revokeLichessToken(conn.accessToken).catch(() => {
          /* local disconnect proceeds regardless (§6.2) */
        });
      }
      await ctx.prisma.platformConnection.delete({ where: { id: conn.id } });
      return { id: conn.id };
    }),
});
