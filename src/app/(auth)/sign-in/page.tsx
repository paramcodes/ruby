"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

import styles from "@/styles/auth.module.css";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await authClient.signIn.email({ email, password });
    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "Sign in failed");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className={styles.shell}>
      <section className={styles.card} aria-labelledby="sign-in-title">
        <h1 className={styles.title} id="sign-in-title">
          Sign in
        </h1>
        <p className={styles.subtitle}>Welcome back to your wiki.</p>
        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              Email
            </label>
            <input
              className={styles.input}
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              Password
            </label>
            <input
              className={styles.input}
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <button className={styles.button} type="submit" disabled={pending}>
            {pending ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className={styles.footer}>
          New here?{" "}
          <a className={styles.link} href="/sign-up">
            Create an account
          </a>
        </p>
      </section>
    </main>
  );
}
