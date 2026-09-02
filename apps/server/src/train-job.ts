import { spawn, type ChildProcess } from "node:child_process";
import type { Server } from "socket.io";
import type { TrainJobStatus } from "@agentic/shared";
import { PYTHON_BIN } from "./config.js";
import { sessionStore } from "./session-store.js";

const jobs = new Map<string, { child: ChildProcess; status: TrainJobStatus }>();

export function getTrainJob(sessionId: string): TrainJobStatus {
  return jobs.get(sessionId)?.status ?? { sessionId, status: "idle", fast: false };
}

export function startTrainJob(
  sessionId: string,
  workspacePath: string,
  io: Server,
  fast: boolean
): TrainJobStatus {
  const existing = jobs.get(sessionId);
  if (existing?.status.status === "running") {
    return existing.status;
  }

  const args = ["scripts/train.py"];
  if (fast) args.push("--fast");

  const child = spawn(PYTHON_BIN, args, {
    cwd: workspacePath,
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
  });

  const status: TrainJobStatus = {
    sessionId,
    status: "running",
    fast,
    startedAt: new Date().toISOString(),
  };
  jobs.set(sessionId, { child, status });
  sessionStore.updateStatus(sessionId, "training");
  io.to(`session:${sessionId}`).emit("train:status", status);

  const emitLog = (chunk: Buffer) => {
    const data = chunk.toString();
    io.to(`session:${sessionId}`).emit("train:log", { sessionId, data });
  };
  child.stdout?.on("data", emitLog);
  child.stderr?.on("data", emitLog);

  child.on("close", (code) => {
    const current = jobs.get(sessionId);
    if (!current) return;
    current.status = {
      ...current.status,
      status: code === 0 ? "completed" : "failed",
      finishedAt: new Date().toISOString(),
      error: code === 0 ? undefined : `Training exited with code ${code}`,
    };
    sessionStore.updateStatus(sessionId, code === 0 ? "ready" : "planning");
    io.to(`session:${sessionId}`).emit("train:status", current.status);
  });

  child.on("error", (err) => {
    const current = jobs.get(sessionId);
    if (!current) return;
    current.status = {
      ...current.status,
      status: "failed",
      finishedAt: new Date().toISOString(),
      error: err.message,
    };
    sessionStore.updateStatus(sessionId, "planning");
    io.to(`session:${sessionId}`).emit("train:status", current.status);
  });

  return status;
}

export function stopTrainJob(sessionId: string, io: Server): TrainJobStatus {
  const current = jobs.get(sessionId);
  if (!current || current.status.status !== "running") {
    return getTrainJob(sessionId);
  }
  current.child.kill("SIGTERM");
  current.status = {
    ...current.status,
    status: "failed",
    finishedAt: new Date().toISOString(),
    error: "Stopped by user",
  };
  sessionStore.updateStatus(sessionId, "planning");
  io.to(`session:${sessionId}`).emit("train:status", current.status);
  return current.status;
}
