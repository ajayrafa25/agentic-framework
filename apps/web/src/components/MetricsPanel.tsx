"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { TrainingMetrics } from "@agentic/shared";
import { useSessionSocket } from "@/hooks/useSocket";
import { fetchSession } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";

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
    <div className="h-full bg-surface p-3 overflow-auto">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-muted">Metrics</h3>
        {metrics && <StatusBadge status={metrics.status} />}
      </div>

      {!metrics ? (
        <p className="text-sm text-muted">No run yet. Use the terminal to start training.</p>
      ) : (
        <>
          <div className="flex gap-6 text-sm mb-2">
            <div>
              <div className="text-xs text-muted">train loss</div>
              <div className="font-mono">{metrics.trainLoss.toFixed(4)}</div>
            </div>
            <div>
              <div className="text-xs text-muted">val loss</div>
              <div className="font-mono">{metrics.valLoss.toFixed(4)}</div>
            </div>
            <div>
              <div className="text-xs text-muted">{metrics.primaryMetricName}</div>
              <div className="font-mono">{metrics.primaryMetric.toFixed(4)}</div>
            </div>
            <div>
              <div className="text-xs text-muted">epoch</div>
              <div className="font-mono">
                {metrics.epoch}/{metrics.totalEpochs}
              </div>
            </div>
          </div>
          {history.length > 0 && (
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={history} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#d0d7de" strokeDasharray="3 3" />
                <XAxis dataKey="epoch" stroke="#656d76" fontSize={11} tickLine={false} />
                <YAxis stroke="#656d76" fontSize={11} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid #d0d7de",
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="trainLoss" stroke="#0969da" dot={false} strokeWidth={1.5} name="train" />
                <Line type="monotone" dataKey="valLoss" stroke="#cf222e" dot={false} strokeWidth={1.5} name="val" />
                <Line type="monotone" dataKey="primaryMetric" stroke="#1f883d" dot={false} strokeWidth={1.5} name={metrics.primaryMetricName} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </>
      )}
    </div>
  );
}
