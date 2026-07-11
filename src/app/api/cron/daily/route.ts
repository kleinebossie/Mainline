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

  try {
    const summary = await runDailyOperations(prisma);
    const incomplete =
      summary.import.errors + summary.maintenance.errors > 0 ||
      summary.queue.remaining > 0;
    return NextResponse.json(summary, { status: incomplete ? 503 : 200 });
  } catch {
    return NextResponse.json(
      { error: "daily_operations_failed" },
      { status: 503 },
    );
  }
}
