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

function getTrustedOrigins(): string[] {
  return [
    ...new Set(
      [
        process.env.BETTER_AUTH_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000"
      ].filter((origin): origin is string => Boolean(origin))
    )
  ];
}

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
    ...(process.env.BETTER_AUTH_RATE_LIMIT_DISABLED === "true"
      ? { rateLimit: { enabled: false } }
      : {}),
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
