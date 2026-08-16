import { beforeEach, describe, expect, it, vi } from "vitest";

const dailyOps = vi.hoisted(() => ({
  runDailyOperations: vi.fn(),
}));
const serverImport = vi.hoisted(() => ({
  runImportForUser: vi.fn(),
}));
const dbClient = vi.hoisted(() => ({
  prisma: {
    platformConnection: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/server/daily-operations", () => dailyOps);
vi.mock("@/server/import", () => serverImport);
vi.mock("@/db/client", () => dbClient);

import { GET as dailyCronGET } from "@/app/api/cron/daily/route";
import { GET as importCronGET } from "@/app/api/cron/import/route";

describe("cron API routes", () => {
  const cronSecret = "secret-cron-token-1234";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = cronSecret;
  });

  describe("/api/cron/daily", () => {
    it("returns 401 unauthorized when CRON_SECRET header is missing or invalid", async () => {
      const reqNoAuth = new Request("http://localhost/api/cron/daily");
      const res1 = await dailyCronGET(reqNoAuth);
      expect(res1.status).toBe(401);

      const reqWrongAuth = new Request("http://localhost/api/cron/daily", {
        headers: { authorization: "Bearer wrong-secret" },
      });
      const res2 = await dailyCronGET(reqWrongAuth);
      expect(res2.status).toBe(401);
      expect(dailyOps.runDailyOperations).not.toHaveBeenCalled();
    });

    it("returns 200 with summary when operations succeed with zero errors", async () => {
      dailyOps.runDailyOperations.mockResolvedValue({
        import: { errors: 0, completed: 5 },
        maintenance: { errors: 0, completed: 2 },
        queue: { remaining: 0 },
      });

      const req = new Request("http://localhost/api/cron/daily", {
        headers: { authorization: `Bearer ${cronSecret}` },
      });
      const res = await dailyCronGET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toMatchObject({
        import: { errors: 0 },
        maintenance: { errors: 0 },
        queue: { remaining: 0 },
      });
    });

    it("returns 503 when operations encounter errors or remaining queue items", async () => {
      dailyOps.runDailyOperations.mockResolvedValue({
        import: { errors: 1, completed: 5 },
        maintenance: { errors: 0, completed: 2 },
        queue: { remaining: 0 },
      });

      const req = new Request("http://localhost/api/cron/daily", {
        headers: { authorization: `Bearer ${cronSecret}` },
      });
      const res = await dailyCronGET(req);
      expect(res.status).toBe(503);
    });

    it("returns 503 when runDailyOperations throws", async () => {
      dailyOps.runDailyOperations.mockRejectedValue(new Error("db down"));

      const req = new Request("http://localhost/api/cron/daily", {
        headers: { authorization: `Bearer ${cronSecret}` },
      });
      const res = await dailyCronGET(req);
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json).toEqual({ error: "daily_operations_failed" });
    });
  });

  describe("/api/cron/import", () => {
    it("returns 401 unauthorized when CRON_SECRET header is missing or invalid", async () => {
      const req = new Request("http://localhost/api/cron/import");
      const res = await importCronGET(req);
      expect(res.status).toBe(401);
      expect(serverImport.runImportForUser).not.toHaveBeenCalled();
    });

    it("runs idempotent import for users with active connections and returns summary", async () => {
      dbClient.prisma.platformConnection.findMany.mockResolvedValue([
        { userId: "u1" },
        { userId: "u2" },
      ]);
      serverImport.runImportForUser
        .mockResolvedValueOnce({ results: [{ imported: 3 }], errors: [] })
        .mockResolvedValueOnce({
          results: [{ imported: 2 }],
          errors: ["failed game"],
        });

      const req = new Request("http://localhost/api/cron/import", {
        headers: { authorization: `Bearer ${cronSecret}` },
      });
      const res = await importCronGET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({
        users: 2,
        imported: 5,
        errors: 1,
      });
      expect(serverImport.runImportForUser).toHaveBeenCalledTimes(2);
    });
  });
});
