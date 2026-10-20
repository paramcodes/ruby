// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

describe("database client", () => {
  it("fails with a clear error on first use when DATABASE_URL is missing", async () => {
    const original = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    vi.resetModules();

    try {
      const { db } = await import("@/server/db/client");

      expect(() => db.execute(sql`select 1`)).toThrow(/DATABASE_URL/);
    } finally {
      if (original !== undefined) {
        process.env.DATABASE_URL = original;
      }
      vi.resetModules();
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
