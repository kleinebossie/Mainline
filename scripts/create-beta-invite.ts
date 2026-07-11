import { randomBytes } from "node:crypto";

import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";

loadEnv({ path: ".env.local" });
loadEnv();

const prisma = new PrismaClient();

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}

async function main() {
  const email = argument("email")?.trim().toLowerCase() || null;
  const requestedCode = argument("code")?.trim();
  const inviteCode =
    requestedCode || (email ? null : randomBytes(18).toString("hex"));
  const expiresInDays = Number(argument("expires-days") ?? "14");
  if (!Number.isSafeInteger(expiresInDays) || expiresInDays < 1) {
    throw new Error("--expires-days must be a positive integer");
  }

  const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000);
  const entry = await prisma.allowlistEntry.create({
    data: { email, inviteCode, expiresAt },
    select: { id: true, email: true, inviteCode: true, expiresAt: true },
  });

  process.stdout.write(
    `${JSON.stringify({
      id: entry.id,
      email: entry.email,
      inviteCode: entry.inviteCode,
      expiresAt: entry.expiresAt.toISOString(),
    })}\n`,
  );
}

main()
  .catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Invite creation failed"}\n`,
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
