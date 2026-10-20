// Vitest global setup. The default unit-test run must stay independent of a
// running database, so DB suites skip when DATABASE_URL is absent. `pnpm
// test:db` sets REQUIRE_DB=1 to make a missing DATABASE_URL a hard failure
// instead of a silently skipped suite.
type DatabaseEnv = Record<string, string | undefined>;

export function assertDatabaseAvailable(env: DatabaseEnv = process.env): void {
  if (env.REQUIRE_DB === "1" && !env.DATABASE_URL) {
    throw new Error(
      "REQUIRE_DB=1 but DATABASE_URL is not set. Start PostgreSQL and set DATABASE_URL before running `pnpm test:db`."
    );
  }
}

export default function globalSetup(): void {
  assertDatabaseAvailable();
}
