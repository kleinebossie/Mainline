// Background import (BUILD.md M2, §5.7). Vercel Cron calls this route on a schedule
// (see vercel.json). It is protected by CRON_SECRET: Vercel sends it as
// `Authorization: Bearer <CRON_SECRET>`. For every user with a live connection we
// run an idempotent import under a per-day JobRun key, so a retried tick is a no-op.
// No chess/learning decision happens here (L1) — this is pure plumbing.

import { NextResponse } from "next/server";
import crypto from "node:crypto";

import { prisma } from "@/db/client";
import { runImportForUser } from "@/server/import";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // seconds (Vercel free-tier cap)

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!secret || !authHeader) {
    return false;
  }

  const expected = `Bearer ${secret}`;

  const expectedBuf = Buffer.from(expected);
  const authHeaderBuf = Buffer.from(authHeader);

  // Prevent unhandled TypeError from timingSafeEqual if lengths differ
  if (expectedBuf.byteLength !== authHeaderBuf.byteLength) {
    return false;
  }

  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    expectedBuf,
    authHeaderBuf
  );
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Day bucket makes the cron idempotent: a re-fired tick reuses the same JobRun key.
  const day = new Date().toISOString().slice(0, 10);

  const userIds = (
    await prisma.platformConnection.findMany({
      where: { status: { not: "revoked" } },
      distinct: ["userId"],
      select: { userId: true },
    })
  ).map((r) => r.userId);

  let imported = 0;
  let errors = 0;
  for (const userId of userIds) {
    const summary = await runImportForUser(
      prisma,
      userId,
      `cron:${day}:${userId}`,
    );
    imported += summary.results.reduce((n, r) => n + r.imported, 0);
    errors += summary.errors.length;
  }

  return NextResponse.json({ users: userIds.length, imported, errors });
}
