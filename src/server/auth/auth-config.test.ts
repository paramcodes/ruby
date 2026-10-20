// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const betterAuth = vi.hoisted(() =>
  vi.fn((options: Record<string, unknown>) => ({ api: {}, options }))
);

vi.mock("server-only", () => ({}));
vi.mock("better-auth", () => ({ betterAuth }));
vi.mock("better-auth/adapters/drizzle", () => ({ drizzleAdapter: () => ({}) }));
vi.mock("better-auth/next-js", () => ({ nextCookies: () => ({}) }));
vi.mock("@/server/db/client", () => ({ db: {} }));
vi.mock("@/server/db/schema", () => ({
  user: {},
  session: {},
  account: {},
  verification: {}
}));

async function loadOptions() {
  vi.resetModules();
  const { getAuth } = await import("@/server/auth/auth");
  getAuth();
  return betterAuth.mock.calls.at(-1)?.[0] as {
    rateLimit?: { enabled: boolean };
    trustedOrigins?: string[];
  };
}

describe("auth config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps rate limiting on in production even with the kill switch", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(40));
    vi.stubEnv("BETTER_AUTH_RATE_LIMIT_DISABLED", "true");

    expect((await loadOptions()).rateLimit).toEqual({ enabled: true });
  });

  it("honors the kill switch outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(40));
    vi.stubEnv("BETTER_AUTH_RATE_LIMIT_DISABLED", "true");

    expect((await loadOptions()).rateLimit).toEqual({ enabled: false });
  });

  it("normalizes a trailing slash in BETTER_AUTH_URL", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(40));
    vi.stubEnv("BETTER_AUTH_URL", "https://wiki.example.com/");

    expect((await loadOptions()).trustedOrigins).toContain(
      "https://wiki.example.com"
    );
  });
});
