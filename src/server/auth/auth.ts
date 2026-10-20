import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/server/db/client";
import { account, session, user, verification } from "@/server/db/schema";

const PLACEHOLDER_SECRET = "dev-secret-change-me-please-32chars";

function getSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;

  if (!secret || secret === PLACEHOLDER_SECRET) {
    throw new Error(
      "BETTER_AUTH_SECRET is not set. Generate a secret with `openssl rand -base64 32` and configure it (see .env.example)."
    );
  }

  return secret;
}

function normalizeOrigin(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    // `URL.origin` strips a trailing slash so origin checks compare cleanly.
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getTrustedOrigins(): string[] {
  return [
    ...new Set(
      [
        process.env.BETTER_AUTH_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        // Playwright runs its own dev server on this port so it never reuses
        // an unrelated process that may already hold 3000.
        "http://localhost:3100",
        "http://127.0.0.1:3100"
      ]
        .map(normalizeOrigin)
        .filter((origin): origin is string => origin !== null)
    )
  ];
}

function getRateLimitOptions(): { enabled: boolean } | undefined {
  if (process.env.NODE_ENV === "production") {
    // Rate limiting is always on in production; the kill switch below is
    // development/test only and never disables it there.
    return { enabled: true };
  }

  if (process.env.BETTER_AUTH_RATE_LIMIT_DISABLED === "true") {
    return { enabled: false };
  }

  return undefined;
}

const rateLimitOptions = getRateLimitOptions();

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session, account, verification }
    }),
    emailAndPassword: {
      enabled: true
    },
    secret: getSecret(),
    baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins: getTrustedOrigins(),
    ...(rateLimitOptions ? { rateLimit: rateLimitOptions } : {}),
    plugins: [nextCookies()]
  });
}

type Auth = ReturnType<typeof createAuth>;

let authInstance: Auth | undefined;

export function getAuth(): Auth {
  authInstance ??= createAuth();
  return authInstance;
}

export const auth = new Proxy({} as Auth, {
  get(_target, property) {
    const instance = getAuth();
    const value = Reflect.get(instance, property);

    return typeof value === "function" ? value.bind(instance) : value;
  },
  has(_target, property) {
    return property in getAuth();
  }
});
