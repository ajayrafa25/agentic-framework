"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ExperimentSession } from "@agentic/shared";
import { DEMO_USERS } from "@agentic/shared";
import { fetchSession, fetchSessions } from "@/lib/api";
import { ChatPanel } from "@/components/ChatPanel";
import { TerminalPanel } from "@/components/TerminalPanel";
import { MetricsPanel } from "@/components/MetricsPanel";
import { ConfigEditor } from "@/components/ConfigEditor";
import { PlanEditor } from "@/components/PlanEditor";

const CURRENT_USER = DEMO_USERS[0];

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<ExperimentSession | null>(null);
  const [sessions, setSessions] = useState<ExperimentSession[]>([]);
  const [tab, setTab] = useState<"workspace" | "plan" | "config">("workspace");

  useEffect(() => {
    params.then((p) => setSessionId(p.id));
  }, [params]);

  useEffect(() => {
    if (!sessionId) return;
    fetchSession(sessionId).then(setSession);
    fetchSessions().then(setSessions);
    const interval = setInterval(() => fetchSession(sessionId).then(setSession), 5000);
    return () => clearInterval(interval);
  }, [sessionId]);

  if (!sessionId || !session) {
    return <div className="min-h-screen bg-bg p-8 text-muted">Loading experiment session...</div>;
  }

  return (
    <div className="h-screen flex bg-bg overflow-hidden">
      <aside className="w-56 border-r border-border flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <Link href="/" className="text-xs text-muted hover:text-accent">← Dashboard</Link>
          <h1 className="font-semibold mt-2">Forge</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/session/${s.id}`}
              className={`block rounded-lg px-3 py-2 text-sm ${
                s.id === sessionId ? "bg-accent/15 text-accent" : "hover:bg-surface-2 text-muted"
              }`}
            >
              {s.name}
            </Link>
          ))}
        </div>
        <div className="p-3 border-t border-border text-xs text-muted">
          {session.branch}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-border px-5 py-3 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-semibold">{session.name}</h2>
            <p className="text-sm text-muted">
              {session.modelArchitecture} · {session.dataset} · {session.status}
            </p>
          </div>
          <div className="flex gap-2 text-sm">
            {(["workspace", "plan", "config"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 rounded-lg ${
                  tab === t ? "bg-accent/20 text-accent" : "text-muted hover:bg-surface-2"
                }`}
              >
                {t === "workspace" ? "Workspace" : t === "plan" ? "Plan" : "Config"}
              </button>
            ))}
          </div>
        </header>

        {tab === "workspace" && (
          <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-3 p-3 min-h-0">
            <ChatPanel sessionId={sessionId} userName={CURRENT_USER.name} userId={CURRENT_USER.id} />
            <MetricsPanel sessionId={sessionId} userName={CURRENT_USER.name} />
            <TerminalPanel sessionId={sessionId} userName={CURRENT_USER.name} />
            <div className="border border-border rounded-xl bg-surface p-4 overflow-y-auto">
              <h3 className="text-sm font-medium mb-3">Session summary</h3>
              <p className="text-sm text-muted leading-relaxed mb-4">{session.description || "No description."}</p>
              <div className="text-xs text-muted space-y-1">
                <p>Discuss hyperparameters and architecture choices in chat before long runs.</p>
                <p>Team members share this terminal, config, and metrics view.</p>
                <p>Use <span className="text-accent">@forge</span> to apply agreed changes to config.</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {DEMO_USERS.map((u) => (
                  <span key={u.id} className="text-xs rounded-full px-2 py-1 bg-surface-2" style={{ color: u.color }}>
                    {u.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "plan" && (
          <div className="flex-1 p-3 min-h-0">
            <PlanEditor sessionId={sessionId} userId={CURRENT_USER.id} />
          </div>
        )}

        {tab === "config" && (
          <div className="flex-1 p-3 min-h-0">
            <ConfigEditor sessionId={sessionId} />
          </div>
        )}
      </div>
    </div>
  );
}
