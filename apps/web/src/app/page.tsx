"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ExperimentSession } from "@agentic/shared";
import { fetchDashboard, fetchSessions } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
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
    <div className="min-h-screen bg-bg">
      <AppHeader />
      <div className="max-w-[1280px] mx-auto px-6 py-6 grid grid-cols-[1fr_280px] gap-8">
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h1 className="text-xl font-semibold">Experiments</h1>
            <span className="text-sm text-muted">{sessions.length} open</span>
          </div>
          <div className="border border-border rounded-md overflow-hidden bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 border-b border-border text-muted text-left">
                <tr>
                  <th className="font-medium px-3 py-2">Name</th>
                  <th className="font-medium px-3 py-2">Model</th>
                  <th className="font-medium px-3 py-2">Dataset</th>
                  <th className="font-medium px-3 py-2">Status</th>
                  <th className="font-medium px-3 py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                    <td className="px-3 py-2">
                      <Link href={`/session/${s.id}`} className="text-link font-medium hover:underline">
                        {s.name}
                      </Link>
                      {s.description ? (
                        <div className="text-muted text-xs mt-0.5 truncate max-w-md">{s.description}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{s.modelArchitecture}</td>
                    <td className="px-3 py-2 font-mono text-xs">{s.dataset}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-3 py-2 text-muted whitespace-nowrap">{relativeTime(s.updatedAt)}</td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted">
                      No experiments yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside>
          <h2 className="text-sm font-semibold mb-2">Activity</h2>
          <ul className="text-sm space-y-3">
            {activity.slice(0, 12).map((a, i) => (
              <li key={i} className="text-muted leading-snug">
                <span className="text-text font-medium">{a.userName}</span> {a.action.toLowerCase()}{" "}
                <span className="text-text">{a.sessionName}</span>
                <div className="text-xs">{relativeTime(a.timestamp)}</div>
              </li>
            ))}
            {activity.length === 0 && <li className="text-muted">Nothing yet.</li>}
          </ul>
        </aside>
      </div>
    </div>
  );
}
