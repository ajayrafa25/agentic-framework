"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { ExperimentSession } from "@agentic/shared";
import { DEMO_USERS } from "@agentic/shared";
import { fetchSession, fetchSessions } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ChatPanel } from "@/components/ChatPanel";
import { TerminalPanel } from "@/components/TerminalPanel";
import { MetricsPanel } from "@/components/MetricsPanel";
import { ConfigEditor } from "@/components/ConfigEditor";
import { PlanEditor } from "@/components/PlanEditor";

const CURRENT_USER = DEMO_USERS[0];

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = use(params);
  const [session, setSession] = useState<ExperimentSession | null>(null);
  const [sessions, setSessions] = useState<ExperimentSession[]>([]);
  const [tab, setTab] = useState<"run" | "plan" | "config">("run");

  useEffect(() => {
    if (!sessionId) return;
    fetchSession(sessionId).then(setSession);
    fetchSessions().then(setSessions);
    const interval = setInterval(() => fetchSession(sessionId).then(setSession), 5000);
    return () => clearInterval(interval);
  }, [sessionId]);

  if (!sessionId || !session) {
    return (
      <div className="min-h-screen bg-bg">
        <AppHeader />
        <p className="p-6 text-muted">Loading…</p>
      </div>
    );
  }

  const tabs = [
    { id: "run" as const, label: "Run" },
    { id: "plan" as const, label: "Plan" },
    { id: "config" as const, label: "Config" },
  ];

  return (
    <div className="h-screen flex flex-col bg-bg overflow-hidden">
      <AppHeader />
      <div className="flex-1 flex min-h-0">
        <aside className="w-[220px] border-r border-border bg-surface flex flex-col shrink-0">
          <div className="px-3 py-2 text-xs font-semibold text-muted">Experiments</div>
          <div className="flex-1 overflow-y-auto">
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={`/session/${s.id}`}
                className={`block px-3 py-1.5 text-sm border-l-2 ${
                  s.id === sessionId
                    ? "border-accent bg-surface-2 font-medium"
                    : "border-transparent text-muted hover:bg-surface-2 hover:text-text"
                }`}
              >
                <div className="truncate">{s.name}</div>
              </Link>
            ))}
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="bg-surface border-b border-border px-4 pt-3 shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="font-semibold">{session.name}</h2>
              <StatusBadge status={session.status} />
              <span className="text-xs text-muted font-mono ml-auto">{session.branch}</span>
            </div>
            <p className="text-sm text-muted mb-2">
              {session.modelArchitecture} · {session.dataset}
              {session.description ? ` — ${session.description}` : ""}
            </p>
            <div className="flex gap-4 text-sm">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`pb-2 border-b-2 -mb-px ${
                    tab === t.id
                      ? "border-[#fd8c73] font-medium"
                      : "border-transparent text-muted hover:text-text"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {tab === "run" && (
            <div className="flex-1 grid grid-cols-[minmax(280px,1fr)_minmax(360px,1.2fr)] min-h-0">
              <ChatPanel sessionId={sessionId} userName={CURRENT_USER.name} userId={CURRENT_USER.id} />
              <div className="flex flex-col min-h-0 border-l border-border">
                <div className="h-[42%] min-h-0">
                  <MetricsPanel sessionId={sessionId} userName={CURRENT_USER.name} />
                </div>
                <div className="flex-1 min-h-0 border-t border-border">
                  <TerminalPanel sessionId={sessionId} userName={CURRENT_USER.name} />
                </div>
              </div>
            </div>
          )}

          {tab === "plan" && (
            <div className="flex-1 min-h-0">
              <PlanEditor sessionId={sessionId} userId={CURRENT_USER.id} />
            </div>
          )}

          {tab === "config" && (
            <div className="flex-1 min-h-0">
              <ConfigEditor sessionId={sessionId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
