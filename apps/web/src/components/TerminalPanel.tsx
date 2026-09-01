"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { useSessionSocket } from "@/hooks/useSocket";

export function TerminalPanel({ sessionId, userName }: { sessionId: string; userName: string }) {
  const socket = useSessionSocket(sessionId, userName);
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: {
        background: "#0c0f14",
        foreground: "#e8ecf4",
        cursor: "#6ee7b7",
      },
      fontFamily: "IBM Plex Mono, monospace",
      fontSize: 13,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    termRef.current = term;

    socket.emit("terminal:start", { sessionId });

    socket.on("terminal:ready", () => {
      term.writeln("Shared experiment terminal — run training scripts here.");
      term.writeln("  python scripts/validate_config.py");
      term.writeln("  python scripts/train.py --dry-run");
      term.writeln("  python scripts/train.py");
    });

    socket.on("terminal:output", ({ data }: { data: string }) => {
      term.write(data);
    });

    term.onData((data) => {
      socket.emit("terminal:input", { sessionId, data });
    });

    const onResize = () => fit.fit();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      term.dispose();
      socket.off("terminal:ready");
      socket.off("terminal:output");
    };
  }, [sessionId, socket]);

  return (
    <div className="flex flex-col h-full border border-border rounded-xl bg-surface overflow-hidden">
      <div className="px-4 py-3 border-b border-border text-sm font-medium">Terminal</div>
      <div ref={containerRef} className="flex-1 p-2 min-h-0" />
    </div>
  );
}
