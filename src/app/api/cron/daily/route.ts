import { NextResponse } from "next/server";

import { prisma } from "@/db/client";
import { runDailyOperations } from "@/server/daily-operations";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(
    secret && req.headers.get("authorization") === `Bearer ${secret}`,
  );
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const summary = await runDailyOperations(prisma);
  const errors = summary.import.errors + summary.maintenance.errors;
  return NextResponse.json(summary, { status: errors > 0 ? 503 : 200 });
}
