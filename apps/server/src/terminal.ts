import type { Socket } from "socket.io";
import * as pty from "node-pty";
import path from "node:path";

const shells = new Map<string, pty.IPty>();

export function spawnTerminal(socket: Socket, sessionId: string, cwd: string): void {
  const existing = shells.get(socket.id);
  if (existing) {
    existing.kill();
    shells.delete(socket.id);
  }

  const shell = process.env.SHELL ?? "/bin/bash";
  const term = pty.spawn(shell, [], {
    name: "xterm-256color",
    cwd,
    env: process.env as Record<string, string>,
    cols: 120,
    rows: 30,
  });

  shells.set(socket.id, term);

  term.onData((data) => {
    socket.emit("terminal:output", { sessionId, data });
  });

  term.onExit(() => {
    shells.delete(socket.id);
  });

  socket.on("terminal:input", ({ sessionId: sid, data }: { sessionId: string; data: string }) => {
    if (sid !== sessionId) return;
    const active = shells.get(socket.id);
    if (active) active.write(data);
  });

  socket.on("terminal:resize", ({ cols, rows }: { cols: number; rows: number }) => {
    const active = shells.get(socket.id);
    if (active) active.resize(cols, rows);
  });

  socket.on("disconnect", () => {
    const active = shells.get(socket.id);
    if (active) {
      active.kill();
      shells.delete(socket.id);
    }
  });
}

export function killTerminal(socketId: string): void {
  const active = shells.get(socketId);
  if (active) {
    active.kill();
    shells.delete(socketId);
  }
}
