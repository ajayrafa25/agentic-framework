"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { useSessionSocket } from "@/hooks/useSocket";

export function TerminalPanel({ sessionId, userName }: { sessionId: string; userName: string }) {
  const socket = useSessionSocket(sessionId, userName);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: {
        background: "#0d1117",
        foreground: "#c9d1d9",
        cursor: "#c9d1d9",
      },
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      fontSize: 12,
      lineHeight: 1.3,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();

    socket.emit("terminal:start", { sessionId });

    socket.on("terminal:ready", () => {
      term.writeln("python scripts/validate_config.py");
      term.writeln("python scripts/train.py");
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
    <div className="flex flex-col h-full bg-[#0d1117] overflow-hidden">
      <div className="px-3 py-1.5 text-xs font-semibold text-[#8b949e] border-b border-[#21262d]">
        Terminal
      </div>
      <div ref={containerRef} className="flex-1 min-h-0 px-1" />
    </div>
  );
}
