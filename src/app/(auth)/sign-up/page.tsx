"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

import styles from "@/styles/auth.module.css";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await authClient.signUp.email({ email, password, name });
    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "Sign up failed");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className={styles.shell}>
      <section className={styles.card} aria-labelledby="sign-up-title">
        <h1 className={styles.title} id="sign-up-title">
          Create account
        </h1>
        <p className={styles.subtitle}>Start your personal wiki.</p>
        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="name">
              Name
            </label>
            <input
              className={styles.input}
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
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
              autoComplete="new-password"
            />
          </div>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <button className={styles.button} type="submit" disabled={pending}>
            {pending ? "Creating..." : "Sign up"}
          </button>
        </form>
        <p className={styles.footer}>
          Already have an account?{" "}
          <a className={styles.link} href="/sign-in">
            Sign in
          </a>
        </p>
      </section>
    </main>
  );
}
