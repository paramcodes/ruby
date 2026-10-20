// @vitest-environment node

import { describe, expect, it } from "vitest";

import { assertDatabaseAvailable } from "./global-setup";

describe("assertDatabaseAvailable", () => {
  it("fails fast when REQUIRE_DB is set without DATABASE_URL", () => {
    expect(() => assertDatabaseAvailable({ REQUIRE_DB: "1" })).toThrow(
      /DATABASE_URL/
    );
  });

  it("passes when REQUIRE_DB is set and DATABASE_URL is present", () => {
    expect(() =>
      assertDatabaseAvailable({
        REQUIRE_DB: "1",
        DATABASE_URL: "postgres://example"
      })
    ).not.toThrow();
  });

  it("passes when REQUIRE_DB is not set", () => {
    expect(() => assertDatabaseAvailable({})).not.toThrow();
  });
});
