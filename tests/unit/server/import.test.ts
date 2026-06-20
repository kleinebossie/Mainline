import { describe, expect, it, vi } from "vitest";

import { withJobRun } from "@/server/import";
import type { PrismaClient } from "@prisma/client";

// M2: the JobRun ledger makes background imports idempotent. A second claim of the
// same key (unique violation on create) is skipped, so a retried cron never doubles.

function fakeDb(createImpl: () => Promise<unknown>) {
  const update = vi.fn().mockResolvedValue(undefined);
  return {
    db: {
      jobRun: { create: vi.fn(createImpl), update },
    } as unknown as PrismaClient,
    update,
  };
}

describe("withJobRun", () => {
  it("runs the body and marks success", async () => {
    const { db, update } = fakeDb(() => Promise.resolve({}));
    const fn = vi.fn().mockResolvedValue("ok");

    const result = await withJobRun(db, "import_sync", "k1", fn);

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "success" }) }),
    );
  });

  it("skips when the key is already claimed (unique violation)", async () => {
    const { db } = fakeDb(() => Promise.reject(new Error("unique")));
    const fn = vi.fn();

    const result = await withJobRun(db, "import_sync", "k1", fn);

    expect(result).toBeUndefined();
    expect(fn).not.toHaveBeenCalled();
  });

  it("records the error and rethrows when the body fails", async () => {
    const { db, update } = fakeDb(() => Promise.resolve({}));
    const boom = new Error("429");

    await expect(
      withJobRun(db, "import_sync", "k1", () => Promise.reject(boom)),
    ).rejects.toThrow("429");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "error" }) }),
    );
  });
});
