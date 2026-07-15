import { describe, expect, it, vi } from "vitest";

import { lockUserProgramMutation } from "@/db/user-mutation-lock";

describe("user program mutation lock", () => {
  it("casts PostgreSQL's void lock result to a Prisma-supported scalar", async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ lock: "" }]);

    await lockUserProgramMutation({ $queryRaw: queryRaw } as never, "user-1");

    const query = queryRaw.mock.calls[0]?.[0] as { sql?: string };
    expect(query.sql).toBe(
      "SELECT pg_advisory_xact_lock(hashtext(?))::text AS lock",
    );
  });
});
