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
import type { TrainingMetrics, TrainJobStatus } from "@agentic/shared";
import { useSessionSocket } from "@/hooks/useSocket";
import { fetchSession, startTraining, stopTraining } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";

export function MetricsPanel({ sessionId, userName }: { sessionId: string; userName: string }) {
  const socket = useSessionSocket(sessionId, userName);
  const [metrics, setMetrics] = useState<TrainingMetrics | null>(null);
  const [job, setJob] = useState<TrainJobStatus | null>(null);
  const [log, setLog] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchSession(sessionId).then((s) => {
      setMetrics(s.metrics ?? null);
      setJob(s.trainJob ?? null);
    });
    socket.emit("metrics:watch", { sessionId });
    socket.on("metrics:update", ({ metrics: m }: { metrics: TrainingMetrics }) => setMetrics(m));
    socket.on("train:status", (status: TrainJobStatus) => setJob(status));
    socket.on("train:log", ({ data }: { data: string }) => {
      setLog((prev) => (prev + data).slice(-4000));
    });
    const interval = setInterval(() => {
      fetchSession(sessionId).then((s) => {
        setMetrics(s.metrics ?? null);
        setJob(s.trainJob ?? null);
      });
    }, 3000);
    return () => {
      clearInterval(interval);
      socket.off("metrics:update");
      socket.off("train:status");
      socket.off("train:log");
    };
  }, [sessionId, socket]);

  const history = metrics?.history ?? [];

  return (
    <div className="h-full bg-surface p-3 overflow-auto">
      <div className="flex items-center justify-between mb-2 gap-2">
        <h3 className="text-xs font-semibold text-muted">Metrics</h3>
        <div className="flex items-center gap-2">
          {metrics && <StatusBadge status={metrics.status} />}
          {job?.status === "running" ? (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  setJob(await stopTraining(sessionId));
                } finally {
                  setBusy(false);
                }
              }}
              className="h-6 px-2 rounded-md border border-border text-[11px]"
            >
              Stop
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setLog("");
                  try {
                    setJob(await startTraining(sessionId, true));
                  } finally {
                    setBusy(false);
                  }
                }}
                className="h-6 px-2 rounded-md border border-border text-[11px]"
              >
                Smoke train
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setLog("");
                  try {
                    setJob(await startTraining(sessionId, false));
                  } finally {
                    setBusy(false);
                  }
                }}
                className="h-6 px-2 rounded-md bg-accent text-[#1a1a1a] text-[11px] font-medium"
              >
                Start training
              </button>
            </>
          )}
        </div>
      </div>
      {job?.status && job.status !== "idle" ? (
        <p className="text-[11px] text-muted mb-2">
          Job: {job.status}
          {job.fast ? " (fast)" : ""}
          {job.error ? ` — ${job.error}` : ""}
        </p>
      ) : null}

      {!metrics ? (
        <p className="text-sm text-muted">No metrics yet. Start training from the buttons above.</p>
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
                <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                <XAxis dataKey="epoch" stroke="#6b7280" fontSize={11} tickLine={false} />
                <YAxis stroke="#6b7280" fontSize={11} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid #d0d7de",
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="trainLoss" stroke="#277da1" dot={false} strokeWidth={1.5} name="train" />
                <Line type="monotone" dataKey="valLoss" stroke="#e63946" dot={false} strokeWidth={1.5} name="val" />
                <Line type="monotone" dataKey="primaryMetric" stroke="#f9c74f" dot={false} strokeWidth={1.5} name={metrics.primaryMetricName} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </>
      )}
      {log ? (
        <pre className="mt-2 text-[11px] font-mono whitespace-pre-wrap max-h-24 overflow-auto bg-[#0d1117] text-[#c9d1d9] rounded p-2">
          {log}
        </pre>
      ) : null}
    </div>
  );
}
