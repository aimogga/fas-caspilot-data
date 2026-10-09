"use client";

import { useState } from "react";
import { isHealthReport, type HealthReport } from "@/lib/health";
import styles from "./page.module.css";

export default function HomePage() {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onCheck(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/health");
      const body: unknown = await response.json();
      if (!response.ok || !isHealthReport(body)) {
        throw new Error("Health check did not return a usable report");
      }
      setReport(body);
    } catch (cause) {
      setReport(null);
      setError(cause instanceof Error ? cause.message : "Health check failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className={styles.page}>
      <p className={styles.kicker}>Local development</p>
      <h1>CasePilot × FAS</h1>
      <p className={styles.lede}>
        Public Data to Proof shell. This page confirms the app and the local
        Supabase API are running. Product screens arrive in later phases.
      </p>
      <button className={styles.button} type="button" onClick={() => void onCheck()} disabled={pending}>
        {pending ? "Checking…" : "Check local services"}
      </button>
      {error ? <p className={styles.error}>{error}</p> : null}
      {report ? (
        <section className={styles.panel} aria-live="polite">
          <h2>{report.ok ? "All checks passed" : "A check failed"}</h2>
          <ul className={styles.checks}>
            {report.checks.map((check) => (
              <li key={check.name}>
                <span>{check.name}</span>
                <span className={check.ok ? styles.ok : styles.bad}>{check.ok ? "up" : "down"}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <form action="/api/auth/signout" method="post">
        <button type="submit">Sign Out</button>
      </form>
    </main>
  );
}
