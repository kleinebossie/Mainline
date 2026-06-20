// Server-side persistence for platform connections (BUILD.md §5.2). Wraps the pure
// `buildPlatformConnectionData` (which enforces the tokenless-Chess.com invariant)
// with the Prisma upsert. Used by the Auth.js events (Lichess link) and the
// connections tRPC router (Chess.com username link).

import type { Platform } from "@/integrations/adapter";
import {
  buildPlatformConnectionData,
  type ConnectionTokens,
} from "@/integrations/connection";
import { prisma } from "@/db/client";

export async function upsertPlatformConnection(args: {
  userId: string;
  platform: Platform;
  externalUsername: string;
  tokens?: ConnectionTokens;
}) {
  const data = buildPlatformConnectionData(args);
  return prisma.platformConnection.upsert({
    where: {
      userId_platform: { userId: args.userId, platform: args.platform },
    },
    create: { userId: args.userId, ...data },
    update: {
      externalUsername: data.externalUsername,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      scopes: data.scopes,
      status: data.status,
    },
  });
}
