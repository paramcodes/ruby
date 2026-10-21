import type { Config } from "@playwright/test";
import { randomUUID } from "node:crypto";

import { PASSWORD } from "./auth-helpers";

/**
 * A dedicated warmup account. Each test run uses a fresh UUID email so repeat
 * runs never collide on Better Auth's unique-email constraint.
 */
const WARMUP_EMAIL = `warmup-${randomUUID()}@example.com`;

/**
 * Cold-start reliability for `next dev`.
 *
 * On a fresh `.next` cache the dev server compiles each route on first request.
 * The create-first-page flow (sign-up → create page → navigate to /pages/[id])
 * touches five routes whose first compile under parallel-worker contention
 * costs 1.5–3.3s each. The first test that pays all of those compiles can push
 * the `expect(page).toHaveURL(/\/pages\/…/)` assertion past its 30s budget, so
 * the suite flakes on a cold cache (and in CI, where the cache is always cold).
 *
 * WebServer (Playwright) starts the dev server and marks it ready; this setup
 * runs afterwards and pre-compiles every route the suite touches by making a
 * throwaway authenticated round-trip. Turbopack compiles each route module once
 * per server process, so every subsequent test sees a warm server and no longer
 * pays cold-compile cost inside its timeout budget.
 */
export default async function globalSetup(config: Config): Promise<void> {
  const base = config.projects[0]?.use?.baseURL ?? "http://127.0.0.1:3100";

  await waitForServer(base, 120_000);

  const client = new WarmingClient(base);

  // Public routes first (no session required): each GET triggers the on-demand
  // compile of that route's modules.
  await client.get("/");
  await client.get("/sign-in");
  await client.get("/sign-up");

  // The Better Auth handler is the heaviest single cold compile (~2.2s).
  // POSTing a throwaway sign-up both compiles `/api/auth/[...all]` and returns
  // a session cookie we reuse to warm the protected routes below.
  const signup = await client.post("/api/auth/sign-up/email", {
    name: "Warmup Bot",
    email: WARMUP_EMAIL,
    password: PASSWORD
  });

  if (!signup.ok) {
    throw new Error(
      `warmup sign-up failed (status ${signup.status}); aborting route warmup`
    );
  }

  // Protected routes short-circuit to /sign-in without a session, so they are
  // only compiled (and only useful to warm) once a cookie is established.
  await client.getAuthed("/");
  await client.getAuthed("/pages/warmup");
}

type CookieStore = Record<string, string>;

/**
 * Minimal cookie jar around native fetch. Captures `set-cookie` responses and
 * replays them as a `cookie` header, so the warmup flow can stay authenticated
 * across the protected routes.
 */
class WarmingClient {
  private readonly base: string;
  private readonly cookies: CookieStore = {};

  constructor(base: string) {
    this.base = base;
  }

  private capture(res: Response): Response {
    const setCookie = (
      res.headers as unknown as { getSetCookie?: () => string[] }
    ).getSetCookie?.();
    if (setCookie) {
      for (const header of setCookie) {
        const pair = header.split(";")[0].trim();
        const idx = pair.indexOf("=");
        if (idx > 0) {
          this.cookies[pair.slice(0, idx)] = pair.slice(idx + 1);
        }
      }
    }
    return res;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const cookie = Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    return {
      ...(cookie ? { cookie } : {}),
      ...extra
    };
  }

  async get(path: string): Promise<Response> {
    return this.capture(
      await fetch(this.base + path, {
        signal: AbortSignal.timeout(15_000),
        headers: { accept: "text/html" }
      })
    );
  }

  async getAuthed(path: string): Promise<Response> {
    return this.capture(
      await fetch(this.base + path, {
        signal: AbortSignal.timeout(15_000),
        headers: { accept: "text/html", ...this.headers() }
      })
    );
  }

  async post(path: string, body: unknown): Promise<Response> {
    const res = await fetch(this.base + path, {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: {
        "content-type": "application/json",
        origin: this.base,
        ...this.headers()
      },
      body: JSON.stringify(body)
    });
    return this.capture(res);
  }
}

async function waitForServer(base: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(base + "/", {
        signal: AbortSignal.timeout(2_000)
      });
      if (res.ok) {
        return;
      }
    } catch {
      // server still booting; keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    `dev server at ${base} did not become ready in ${timeoutMs}ms`
  );
}
