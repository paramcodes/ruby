// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

describe("database client", () => {
  it("throws a clear error when DATABASE_URL is missing", async () => {
    const original = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    vi.resetModules();

    await expect(import("@/server/db/client")).rejects.toThrow(/DATABASE_URL/);

    if (original !== undefined) {
      process.env.DATABASE_URL = original;
    }
  });

  it("connects to PostgreSQL and runs a query", async () => {
    if (!process.env.DATABASE_URL) {
      return;
    }

    vi.resetModules();
    const { db } = await import("@/server/db/client");
    const rows = await db.execute(sql`select 1 as value`);

    expect(Array.isArray(rows) ? rows.length : 0).toBeGreaterThan(0);
  });
});
