"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { TrainingMetrics } from "@agentic/shared";
import { useSessionSocket } from "@/hooks/useSocket";
import { fetchSession } from "@/lib/api";

export function MetricsPanel({ sessionId, userName }: { sessionId: string; userName: string }) {
  const socket = useSessionSocket(sessionId, userName);
  const [metrics, setMetrics] = useState<TrainingMetrics | null>(null);

  useEffect(() => {
    fetchSession(sessionId).then((s) => setMetrics(s.metrics ?? null));
    socket.emit("metrics:watch", { sessionId });
    socket.on("metrics:update", ({ metrics: m }: { metrics: TrainingMetrics }) => setMetrics(m));
    const interval = setInterval(() => {
      fetchSession(sessionId).then((s) => setMetrics(s.metrics ?? null));
    }, 3000);
    return () => {
      clearInterval(interval);
      socket.off("metrics:update");
    };
  }, [sessionId, socket]);

  const history = metrics?.history ?? [];

  return (
    <div className="border border-border rounded-xl bg-surface p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">Training metrics</h3>
        {metrics && (
          <span className="text-xs rounded-full px-2 py-0.5 bg-surface-2 text-muted">
            {metrics.status}
          </span>
        )}
      </div>

      {!metrics ? (
        <p className="text-sm text-muted">No training run yet. Validate config and start training in the terminal.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
            <div className="rounded-lg bg-surface-2 p-3">
              <div className="text-muted text-xs">Train loss</div>
              <div className="font-mono text-lg">{metrics.trainLoss.toFixed(4)}</div>
            </div>
            <div className="rounded-lg bg-surface-2 p-3">
              <div className="text-muted text-xs">Val loss</div>
              <div className="font-mono text-lg">{metrics.valLoss.toFixed(4)}</div>
            </div>
            <div className="rounded-lg bg-surface-2 p-3">
              <div className="text-muted text-xs">{metrics.primaryMetricName}</div>
              <div className="font-mono text-lg text-accent">{metrics.primaryMetric.toFixed(4)}</div>
            </div>
          </div>
          {history.length > 0 && (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={history}>
                <XAxis dataKey="epoch" stroke="#8b95a8" fontSize={11} />
                <YAxis stroke="#8b95a8" fontSize={11} />
                <Tooltip contentStyle={{ background: "#1a2030", border: "1px solid #2a3344" }} />
                <Legend />
                <Line type="monotone" dataKey="trainLoss" stroke="#818cf8" dot={false} name="Train loss" />
                <Line type="monotone" dataKey="valLoss" stroke="#f87171" dot={false} name="Val loss" />
                <Line type="monotone" dataKey="primaryMetric" stroke="#6ee7b7" dot={false} name={metrics.primaryMetricName} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </>
      )}
    </div>
  );
}
