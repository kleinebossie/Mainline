import { describe, expect, it } from "vitest";

import { withBoundedConnectionPool } from "@/db/client";

describe("Prisma connection URL", () => {
  it("adds a conservative connection limit when none is configured", () => {
    const result = withBoundedConnectionPool(
      "postgresql://user:password@example.com:5432/mainline?schema=public",
    );

    expect(new URL(result!).searchParams.get("connection_limit")).toBe("5");
  });

  it("preserves an explicitly configured connection limit", () => {
    const result = withBoundedConnectionPool(
      "postgresql://user:password@example.com:5432/mainline?connection_limit=2",
    );

    expect(new URL(result!).searchParams.get("connection_limit")).toBe("2");
  });
});
