"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { ExperimentSession } from "@agentic/shared";
import { DEMO_USERS } from "@agentic/shared";
import { fetchSession, fetchSessions } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
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
    fetchSession(sessionId).then(setSession);
    fetchSessions().then(setSessions);
    const interval = setInterval(() => fetchSession(sessionId).then(setSession), 5000);
    return () => clearInterval(interval);
  }, [sessionId]);

  if (!session) {
    return (
      <AppShell>
        <p className="p-6 text-muted">Loading…</p>
      </AppShell>
    );
  }

  const tabs = [
    { id: "run" as const, label: "Charts" },
    { id: "plan" as const, label: "Plan" },
    { id: "config" as const, label: "Config" },
  ];

  return (
    <AppShell>
      <div className="flex-1 flex min-h-0">
        <aside className="w-[200px] border-r border-border bg-surface flex flex-col shrink-0">
          <div className="h-9 px-3 flex items-center text-[11px] font-semibold text-muted uppercase tracking-wide border-b border-border">
            Runs
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {sessions.map((s, i) => (
              <Link
                key={s.id}
                href={`/session/${s.id}`}
                className={`flex items-center gap-2 px-3 py-1.5 text-[13px] ${
                  s.id === sessionId ? "bg-[#fff8e1]" : "hover:bg-surface-2 text-muted hover:text-text"
                }`}
              >
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ background: i === 0 ? "#f9c74f" : "#277da1" }}
                />
                <span className="truncate">{s.name}</span>
              </Link>
            ))}
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="bg-surface border-b border-border px-4 pt-3 shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-semibold text-[15px] text-balance">{session.name}</h2>
              <StatusBadge status={session.status} />
              <span className="text-[11px] text-muted font-mono ml-auto">{session.branch}</span>
            </div>
            <p className="text-[12px] text-muted mb-2">
              {session.modelArchitecture} · {session.dataset}
              {session.description ? ` — ${session.description}` : ""}
            </p>
            <div className="flex gap-5 text-[13px]">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`pb-2 border-b-2 -mb-px ${
                    tab === t.id ? "border-[#1a1a1a] font-medium" : "border-transparent text-muted hover:text-text"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {tab === "run" && (
            <div className="flex-1 grid grid-cols-[minmax(260px,0.9fr)_minmax(380px,1.2fr)] min-h-0">
              <ChatPanel sessionId={sessionId} userName={CURRENT_USER.name} userId={CURRENT_USER.id} />
              <div className="flex flex-col min-h-0 border-l border-border">
                <div className="h-[46%] min-h-0">
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
    </AppShell>
  );
}
