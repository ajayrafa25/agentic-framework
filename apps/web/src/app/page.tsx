"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ExperimentSession } from "@agentic/shared";
import { fetchDashboard } from "@/lib/api";

interface DashboardData {
  pickBackUp: ExperimentSession[];
  recentSessions: ExperimentSession[];
  teamPulse: Array<{ userName: string; action: string; sessionName: string; timestamp: string }>;
  summary: string;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetchDashboard().then(setData);
  }, []);

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Forge</h1>
          <p className="text-sm text-muted">Collaborative ML development</p>
        </div>
        <Link
          href="/new"
          className="rounded-lg bg-accent/20 text-accent px-4 py-2 text-sm font-medium hover:bg-accent/30"
        >
          New experiment
        </Link>
      </header>

      <main className="max-w-6xl mx-auto p-6 grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">Morning briefing</h2>
          <p className="text-lg leading-relaxed">{data?.summary ?? "Loading..."}</p>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">Pick back up</h2>
          <div className="space-y-2">
            {(data?.pickBackUp ?? []).map((s) => (
              <Link
                key={s.id}
                href={`/session/${s.id}`}
                className="block rounded-lg border border-border bg-surface-2 p-3 hover:border-accent/40 transition"
              >
                <div className="font-medium">{s.name}</div>
                <div className="text-sm text-muted">{s.modelArchitecture} · {s.dataset} · {s.status}</div>
              </Link>
            ))}
            {data && data.pickBackUp.length === 0 && (
              <p className="text-muted text-sm">No active experiments. Start a new session.</p>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">Recent experiments</h2>
          <div className="space-y-2">
            {(data?.recentSessions ?? []).map((s) => (
              <Link
                key={s.id}
                href={`/session/${s.id}`}
                className="flex justify-between rounded-lg border border-border bg-surface-2 p-3 hover:border-accent-2/40 transition"
              >
                <span>{s.name}</span>
                <span className="text-muted text-sm">{s.status}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">Team pulse</h2>
          <div className="space-y-3">
            {(data?.teamPulse ?? []).slice(0, 6).map((a, i) => (
              <div key={i} className="text-sm">
                <span className="font-medium text-accent-2">{a.userName}</span>
                <span className="text-muted"> — {a.action} on </span>
                <span>{a.sessionName}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
