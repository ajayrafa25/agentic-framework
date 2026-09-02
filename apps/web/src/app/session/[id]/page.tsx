"use client";

import { use, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { ExperimentSession } from "@agentic/shared";
import { fetchGitStatus, fetchSession, fetchSessions, openPullRequest } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { ChatPanel } from "@/components/ChatPanel";
import { MetricsPanel } from "@/components/MetricsPanel";
import { ConfigEditor } from "@/components/ConfigEditor";
import { PlanEditor } from "@/components/PlanEditor";
import { CheckpointsPanel } from "@/components/CheckpointsPanel";
import { useAuth } from "@/components/AuthProvider";

const TerminalPanel = dynamic(
  () => import("@/components/TerminalPanel").then((m) => m.TerminalPanel),
  { ssr: false }
);

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = use(params);
  const { user } = useAuth();
  const [session, setSession] = useState<ExperimentSession | null>(null);
  const [sessions, setSessions] = useState<ExperimentSession[]>([]);
  const [tab, setTab] = useState<"run" | "plan" | "config" | "checkpoints">("run");
  const [git, setGit] = useState<{
    dirty?: boolean;
    lastCommit?: string;
    githubConfigured?: boolean;
  }>({});
  const [prBusy, setPrBusy] = useState(false);
  const [prError, setPrError] = useState<string | null>(null);

  useEffect(() => {
    fetchSession(sessionId).then(setSession);
    fetchSessions().then(setSessions);
    fetchGitStatus(sessionId).then(setGit);
    const interval = setInterval(() => {
      fetchSession(sessionId).then(setSession);
      fetchGitStatus(sessionId).then(setGit);
    }, 5000);
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
    { id: "checkpoints" as const, label: "Checkpoints" },
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
              {session.githubPrUrl ? (
                <a
                  href={session.githubPrUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[12px] text-link hover:underline"
                >
                  View PR
                </a>
              ) : (
                <button
                  type="button"
                  disabled={prBusy}
                  onClick={async () => {
                    setPrBusy(true);
                    setPrError(null);
                    try {
                      const result = await openPullRequest(sessionId);
                      setSession({ ...session, githubPrUrl: result.url });
                    } catch (err) {
                      setPrError(err instanceof Error ? err.message : "Failed to open PR");
                    } finally {
                      setPrBusy(false);
                    }
                  }}
                  className="h-6 px-2 rounded-md bg-accent text-[#1a1a1a] text-[12px] font-medium disabled:opacity-60"
                >
                  {prBusy ? "Opening…" : "Open GitHub PR"}
                </button>
              )}
            </div>
            <p className="text-[12px] text-muted mb-2">
              {session.modelArchitecture} · {session.dataset}
              {session.description ? ` — ${session.description}` : ""}
              {git.lastCommit ? ` · ${git.lastCommit}` : ""}
              {git.dirty ? " · uncommitted changes" : ""}
            </p>
            {prError ? <p className="text-[12px] text-red-600 mb-2">{prError}</p> : null}
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
              <ChatPanel sessionId={sessionId} userName={user.name} userId={user.id} />
              <div className="flex flex-col min-h-0 border-l border-border">
                <div className="h-[46%] min-h-0">
                  <MetricsPanel sessionId={sessionId} userName={user.name} />
                </div>
                <div className="flex-1 min-h-0 border-t border-border">
                  <TerminalPanel sessionId={sessionId} userName={user.name} />
                </div>
              </div>
            </div>
          )}

          {tab === "plan" && (
            <div className="flex-1 min-h-0">
              <PlanEditor sessionId={sessionId} userId={user.id} />
            </div>
          )}

          {tab === "config" && (
            <div className="flex-1 min-h-0">
              <ConfigEditor sessionId={sessionId} />
            </div>
          )}

          {tab === "checkpoints" && (
            <div className="flex-1 min-h-0">
              <CheckpointsPanel sessionId={sessionId} />
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
