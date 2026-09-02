"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ExperimentSession } from "@agentic/shared";
import { fetchDashboard, fetchSessions } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { relativeTime } from "@/lib/time";

interface Activity {
  userName: string;
  action: string;
  sessionName: string;
  timestamp: string;
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<ExperimentSession[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);

  useEffect(() => {
    fetchSessions().then(setSessions);
    fetchDashboard().then((d) => setActivity(d.teamPulse ?? []));
  }, []);

  return (
    <AppShell>
      <header className="h-12 shrink-0 border-b border-border bg-surface px-4 flex items-center justify-between">
        <div className="text-[13px] text-muted">
          <span className="text-text font-medium">Runs</span>
          <span className="mx-2">/</span>
          default
        </div>
        <Link
          href="/new"
          className="h-7 px-3 rounded-md bg-accent text-[#1a1a1a] text-[13px] font-medium inline-flex items-center hover:brightness-95"
        >
          New run
        </Link>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-[1fr_240px]">
        <div className="overflow-auto p-4">
          <table className="w-full text-[13px] bg-surface border border-border rounded-md overflow-hidden">
            <thead className="bg-surface-2 text-muted text-left">
              <tr>
                <th className="font-medium px-3 py-2">Name</th>
                <th className="font-medium px-3 py-2">State</th>
                <th className="font-medium px-3 py-2">Model</th>
                <th className="font-medium px-3 py-2">Dataset</th>
                <th className="font-medium px-3 py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-surface-2">
                  <td className="px-3 py-2">
                    <Link href={`/session/${s.id}`} className="text-link hover:underline font-medium">
                      {s.name}
                    </Link>
                    {s.description ? (
                      <div className="text-muted text-[12px] mt-0.5 max-w-lg truncate">{s.description}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-3 py-2 font-mono text-[12px] tabular">{s.modelArchitecture}</td>
                  <td className="px-3 py-2 font-mono text-[12px] tabular">{s.dataset}</td>
                  <td className="px-3 py-2 text-muted whitespace-nowrap">{relativeTime(s.updatedAt)}</td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-muted">
                    No runs in this project.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <aside className="border-l border-border bg-surface p-4 overflow-auto">
          <h2 className="text-[12px] font-semibold text-muted mb-3 uppercase tracking-wide">Activity</h2>
          <ul className="space-y-3 text-[12px] text-pretty">
            {activity.slice(0, 12).map((a, i) => (
              <li key={i}>
                <span className="font-medium text-text">{a.userName}</span> {a.action.toLowerCase()}{" "}
                <span className="text-text">{a.sessionName}</span>
                <div className="text-muted">{relativeTime(a.timestamp)}</div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </AppShell>
  );
}
